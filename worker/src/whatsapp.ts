import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env, WhatsAppWebhookEvent, WhatsAppMessage, WhatsAppValue, PageConnection } from './types';
import { createSupabaseAdmin } from './supabase';
import { handleChatMessage, triggerSlidingWindowSummarization } from './chat';
import { handleFlowInteraction, handleFlowTextInput, startFlow, executeNode } from './chat/flow-engine';
import {
  getWhatsAppConnectionFallback,
  getUserRecord,
  getMonthlyMessageCountFallback,
  storeIncomingMessageFallback,
  updateMessageMetadataFallback,
  acquireSessionLockFallback,
  releaseSessionLockFallback,
  getChatSessionFallback,
  getLatestMessageRoleFallback,
  storeAssistantMessageFallback,
  updateSessionSenderNameFallback
} from './db';

/**
 * Send a WhatsApp reply using the Meta Cloud API.
 */
export async function sendWhatsAppReply(
  phoneNumberId: string,
  accessToken: string,
  recipientPhoneNumber: string,
  messageText: string
): Promise<{ success: boolean; error?: string }> {
  // WhatsApp has a limit of 4096 characters per message.
  // Split long responses if needed.
  const MAX_LENGTH = 4000;
  const messages = splitMessage(messageText, MAX_LENGTH);
  let lastError: string | undefined;

  for (const msg of messages) {
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhoneNumber,
      type: 'text',
      text: {
        preview_url: false,
        body: msg,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[WhatsApp] ❌ Failed to send reply (${response.status}):`, errorBody);
        lastError = errorBody;
      } else {
        console.log(`[WhatsApp] ✅ Reply sent to ${recipientPhoneNumber}`);
      }
    } catch (error: any) {
      console.error('[WhatsApp] ❌ Network error sending reply:', error);
      lastError = error.message;
    }
  }

  if (lastError) {
    return { success: false, error: lastError };
  }
  return { success: true };
}

/**
 * Split a long message into chunks that respect word boundaries.
 */
function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = maxLength; // Force split
    }

    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks;
}

function calculateBillingCycle(
  anchorDateStr: string | undefined
) {
  let cycleAnchor = new Date();
  if (anchorDateStr) {
    cycleAnchor = new Date(anchorDateStr);
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  let startDate = new Date(currentYear, currentMonth, cycleAnchor.getDate(), cycleAnchor.getHours(), cycleAnchor.getMinutes(), cycleAnchor.getSeconds());
  
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  if (cycleAnchor.getDate() > daysInMonth) {
    startDate.setDate(daysInMonth);
  }
  
  if (startDate > now) {
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear -= 1;
    }
    startDate = new Date(prevYear, prevMonth, cycleAnchor.getDate(), cycleAnchor.getHours(), cycleAnchor.getMinutes(), cycleAnchor.getSeconds());
    const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
    if (cycleAnchor.getDate() > daysInPrevMonth) {
      startDate.setDate(daysInPrevMonth);
    }
  }

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);

  return { startDate, endDate };
}

/**
 * Process WhatsApp Webhook entries from Meta.
 */
export async function processWhatsAppWebhookEntries(
  event: WhatsAppWebhookEvent,
  env: Env,
  expectedUserId: string
): Promise<void> {
  const supabase = createSupabaseAdmin(env);

  for (const entry of event.entry) {
    console.log(`[WhatsApp Webhook] Processing entry: ${entry.id}`);

    if (!entry.changes || entry.changes.length === 0) {
      console.log(`[WhatsApp Webhook] No changes in entry ${entry.id}`);
      continue;
    }

    for (const change of entry.changes) {
      const value = change.value;
      if (!value || value.messaging_product !== 'whatsapp') {
        continue;
      }

      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) {
        console.warn(`[WhatsApp Webhook] Missing phone_number_id in metadata`);
        continue;
      }

      // 1. Look up which tenant owns this WhatsApp number
      const pageConnection = await getWhatsAppConnectionFallback(env.DB, supabase, phoneNumberId);

      if (!pageConnection) {
        console.warn(
          `[WhatsApp Webhook] ⚠️ No active connection found for phone ${phoneNumberId} — ignoring`
        );
        continue;
      }

      // Check tenant limits and status
      const userRecord = await getUserRecord(env.DB, supabase, pageConnection.user_id);

      if (userRecord?.is_suspended) {
        console.log(`[WhatsApp Webhook] 🚫 Tenant ${pageConnection.user_id} is suspended. Ignoring messages.`);
        continue;
      }

      if (userRecord?.is_paused) {
        console.log(`[WhatsApp Webhook] ⏸️ Tenant ${pageConnection.user_id} is paused by administrator. Ignoring messages.`);
        continue;
      }

      if (userRecord?.settings?.is_bot_active === false) {
        console.log(`[WhatsApp Webhook] ⏸️ Service is paused for tenant: ${pageConnection.user_id}. Ignoring messages.`);
        continue;
      }

      if (userRecord?.allowed_channels === undefined || userRecord?.allowed_channels <= 0) {
        console.log(`[WhatsApp Webhook] 🚫 Tenant ${pageConnection.user_id} has 0 allowed channels. Ignoring messages.`);
        continue;
      }

      // Message quota is now checked atomically during chat reply handling via verifyAndDeductCredits

      console.log(`[WhatsApp Webhook] Routed to tenant: ${pageConnection.user_id} (WA Phone ID: ${phoneNumberId})`);

      if (!value.messages || value.messages.length === 0) {
        continue;
      }

      // Process each message
      for (const message of value.messages) {
        await handleWhatsAppMessage(supabase, env, pageConnection, value, message);
      }
    }
  }
}

/**
 * Handles processing of a single WhatsApp message event.
 */
async function handleWhatsAppMessage(
  supabase: SupabaseClient,
  env: Env,
  pageConnection: PageConnection,
  value: WhatsAppValue,
  message: WhatsAppMessage
): Promise<void> {
  const senderPhoneNumber = message.from;
  const phoneNumberId = value.metadata.phone_number_id;

  // Extract text and attachments
  let messageText = '';
  let attachmentType = '';
  let buttonReplyId = '';

  if (message.type === 'text') {
    messageText = message.text?.body || '';
  } else if (message.type === 'interactive') {
    buttonReplyId = message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || '';
    messageText = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '';
  } else {
    // Media or other types (e.g. image, audio, video, document, voice)
    attachmentType = message.type;
  }

  const messageId = message.id || Date.now().toString();

  if (buttonReplyId && buttonReplyId.startsWith('FLOW_NODE_ID:')) {
    console.log(`[WhatsApp Webhook] 🔘 WhatsApp Flow Button payload: ${buttonReplyId}`);
    const tappedText = `[Tapped: ${messageText || 'Option'}]`;
    const result = await storeIncomingMessageFallback(
      env.DB,
      supabase,
      pageConnection.user_id,
      phoneNumberId,
      senderPhoneNumber,
      tappedText,
      messageId,
      pageConnection.access_token
    );
    if (result) {
      const handled = await handleFlowInteraction(
        env.DB,
        supabase,
        result.sessionId,
        buttonReplyId,
        pageConnection,
        senderPhoneNumber
      );
      if (handled) {
        return; // Exit webhook handler since flow advanced.
      }

      // If handleFlowInteraction returned false, check if a flow is still active
      const activeFlow = await env.DB.prepare(
        `SELECT current_node_id FROM chat_session_flows WHERE session_id = ?`
      )
        .bind(result.sessionId)
        .first<{ current_node_id: string }>();

      if (activeFlow && activeFlow.current_node_id) {
        console.log(`[WhatsApp Webhook] Mismatched button interaction. Flow still active at node ${activeFlow.current_node_id}. Resending options.`);
        await executeNode(
          env.DB,
          supabase,
          result.sessionId,
          activeFlow.current_node_id,
          pageConnection,
          senderPhoneNumber
        );
      } else {
        console.log(`[WhatsApp Webhook] Expired button interaction. No active flow session.`);
      }
    }
    return; // Block raw payload from reaching AI chatbot under any circumstances
  }

  if (!messageText && !attachmentType) {
    return;
  }

  let contentToStore = messageText;
  if (!messageText && attachmentType) {
    contentToStore = `[Attachment: ${attachmentType}]`;
  }

  console.log(`[WhatsApp Webhook] 💬 Message from ${senderPhoneNumber}: "${contentToStore.substring(0, 100)}..." (Type: ${message.type})`);

  // Store message and get/create session
  // Note: we pass phoneNumberId as the pageId in session creation to isolate it
  const result = await storeIncomingMessageFallback(
    env.DB,
    supabase,
    pageConnection.user_id,
    phoneNumberId,
    senderPhoneNumber,
    contentToStore,
    messageId,
    pageConnection.access_token
  );

  if (!result) return;
  console.log(`[WhatsApp Webhook] ✅ Message stored in session: ${result.sessionId}`);

  // Check if there is an active flow session
  const activeFlow = await env.DB.prepare(
    `SELECT current_node_id FROM chat_session_flows WHERE session_id = ?`
  )
    .bind(result.sessionId)
    .first<{ current_node_id: string }>();

  if (activeFlow) {
    if (messageText) {
      const handledText = await handleFlowTextInput(env.DB, supabase, result.sessionId, messageText, pageConnection, senderPhoneNumber);
      if (handledText) {
        console.log(`[Flow Engine] WhatsApp Flow advanced via text input`);
        return;
      }
    }
    
    // Either messageText is empty (user sent attachment/media) or handleFlowTextInput returned false (mismatched text)
    console.log(`[Flow Engine] WhatsApp Mismatched/unsupported input during flow. Resending options for node ${activeFlow.current_node_id}`);
    await executeNode(env.DB, supabase, result.sessionId, activeFlow.current_node_id, pageConnection, senderPhoneNumber);
    return;
  }

  // Fetch name from contacts profile in the webhook and save to the chat_session if missing
  const contactName = value.contacts?.find(c => c.wa_id === senderPhoneNumber)?.profile?.name || 'WhatsApp User';
  await updateSessionSenderNameFallback(env.DB, supabase, result.sessionId, contactName);

  // ── Debounce period ──────────────────────────────────────────────────────
  // Wait 1.5 seconds to let any companion images/texts arrive and write to DB
  console.log(`[WhatsApp Webhook] ⏳ Debouncing session ${result.sessionId} for 1.5s...`);
  await new Promise(resolve => setTimeout(resolve, 1500));

  // ── Concurrency Lock: Acquire exclusive lock on this chat session ────────
  // Same pattern as Facebook Messenger — ensures only ONE worker processes a session at a time.
  const MAX_LOCK_RETRIES = 5;
  let lockAcquired = false;

  for (let attempt = 0; attempt < MAX_LOCK_RETRIES; attempt++) {
    lockAcquired = await acquireSessionLockFallback(env.DB, supabase, result.sessionId, 30);
    if (lockAcquired) break;

    console.log(`[WhatsApp Webhook] ⏳ Session ${result.sessionId} is locked. Retry ${attempt + 1}/${MAX_LOCK_RETRIES}...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (!lockAcquired) {
    console.warn(`[WhatsApp Webhook] ⚠️ Could not acquire lock for session ${result.sessionId} after ${MAX_LOCK_RETRIES} retries. Skipping to prevent tangling.`);
    return;
  }

  try {
    // ── Check if bot was paused or already responded to ───────────────────
    const sessionRes = await getChatSessionFallback(env.DB, supabase, result.sessionId);
    const latestMsgRole = await getLatestMessageRoleFallback(env.DB, supabase, result.sessionId);

    if (sessionRes?.bot_paused) {
      console.log(`[WhatsApp Webhook] ⏸️ Bot is paused for session ${result.sessionId}. Skipping AI response.`);
      return;
    }

    if (latestMsgRole && latestMsgRole !== 'user') {
      console.log(`[WhatsApp Webhook] ⏭️ Session ${result.sessionId} was already responded to (latest role: ${latestMsgRole}). Skipping.`);
      return;
    }

    // Handle Unsupported Attachments (No Text, and not interactive or image)
    const isImage = message.type === 'image';
    const isSupportedType = message.type === 'text' || message.type === 'interactive' || isImage;

    if (!isSupportedType) {
      const cannedResponse = "Thanks for sending that! I can currently only understand text and images. " +
        "If you have a question, please type it out and I'll be happy to help. 😊";

      await sendWhatsAppReply(phoneNumberId, pageConnection.access_token, senderPhoneNumber, cannedResponse);

      await storeAssistantMessageFallback(
        env.DB,
        supabase,
        result.sessionId,
        pageConnection.user_id,
        cannedResponse,
        null,
        { is_attachment_response: true }
      );
      return;
    }
    // Handle Image attachment URLs if it's an image
    if (isImage && message.image) {
      try {
        const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${message.image.id}`, {
          headers: { 'Authorization': `Bearer ${pageConnection.access_token}` },
        });
        if (mediaRes.ok) {
          const mediaData: any = await mediaRes.json();
          if (mediaData.url) {
            await updateMessageMetadataFallback(
              env.DB,
              supabase,
              messageId,
              { 
                attachment_types: ['image'], 
                attachment_urls: [mediaData.url] 
              }
            );
          }
        }
      } catch (e) {
        console.error('[WhatsApp] Error fetching image URL:', e);
      }
    }
    // ── Phase 1.5: Trigger Word Detection ──────────────────────────
    if (messageText) {
      const triggerWords = Array.isArray(pageConnection.trigger_words) ? pageConnection.trigger_words : [];
      let isTriggerHit = false;

      if (pageConnection.is_trigger_enabled && triggerWords.length > 0) {
        const lowerText = messageText.toLowerCase();
        isTriggerHit = triggerWords.some((word: string) => lowerText.includes(word.toLowerCase()));
      }

      if (isTriggerHit) {
        console.log(`[WhatsApp Webhook] 🚨 Trigger word detected for session ${result.sessionId}`);

        const responses = Array.isArray(pageConnection.trigger_responses) && pageConnection.trigger_responses.length > 0
          ? pageConnection.trigger_responses
          : ["I need to transfer you to a human agent. Please hold on."];

        const randomResponse = responses[Math.floor(Math.random() * responses.length)];

        await sendWhatsAppReply(phoneNumberId, pageConnection.access_token, senderPhoneNumber, randomResponse);

        await storeAssistantMessageFallback(
          env.DB,
          supabase,
          result.sessionId,
          pageConnection.user_id,
          randomResponse,
          null,
          { is_trigger_response: true }
        );

        let existingMetadata: any = {};
        try {
          const { data } = await supabase.from('chat_sessions').select('metadata').eq('id', result.sessionId).single();
          existingMetadata = data?.metadata || {};
          await supabase.from('chat_sessions').update({
            bot_paused: true,
            metadata: { ...existingMetadata, has_trigger: true }
          }).eq('id', result.sessionId);
        } catch (err: any) {
          console.warn(`[Failover] Failed to update WA session trigger metadata: ${err.message}`);
        }
        await env.DB.prepare(`UPDATE chat_sessions SET bot_paused = 1 WHERE id = ?`).bind(result.sessionId).run();

        return; // Stop AI generation
      }
    }

    // ── Phase 2: Full AI Response Pipeline ──────────────────────
    const chatResult = await handleChatMessage(
      supabase,
      result.sessionId,
      pageConnection,
      contentToStore,
      senderPhoneNumber,
      env.DB
    );

    console.log(
      `[WhatsApp Webhook] 🤖 AI response via ${chatResult.provider}/${chatResult.model}` +
      ` | Tokens: ${chatResult.tokensUsed ?? '?'}` +
      ` | RAG: ${chatResult.ragUsed}`
    );

    // Apply short human-like randomized delay BEFORE sending the WhatsApp message.
    // WhatsApp doesn't support typing indicators, so we keep this under 1 second to avoid feeling frozen.
    let extraDelayMs = 0;
    if (Math.random() < 0.70) {
      extraDelayMs = Math.floor(Math.random() * 600) + 200; // 70% chance of 0.2 to 0.8 seconds delay
    }

    if (extraDelayMs > 0) {
      console.log(`[WhatsApp Webhook] ⏳ Adding short human-like delay of ${extraDelayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, extraDelayMs));
    }

    await sendWhatsAppReply(
      phoneNumberId,
      pageConnection.access_token,
      senderPhoneNumber,
      chatResult.reply
    );

    if (chatResult.flowId) {
      console.log(`[WhatsApp Webhook] AI triggered Flow ${chatResult.flowId}`);
      await startFlow(env.DB, supabase, result.sessionId, chatResult.flowId, pageConnection, senderPhoneNumber);
    }

    // ── Phase 3: Sliding Window Summarization ──────────────────────
    try {
      await triggerSlidingWindowSummarization(
        supabase,
        result.sessionId,
        pageConnection,
        senderPhoneNumber
      );
    } catch (err: any) {
      console.warn(`[Failover] WhatsApp summarization failed or skipped during outage: ${err.message}`);
    }
  } finally {
    await releaseSessionLockFallback(env.DB, supabase, result.sessionId);
  }
}
