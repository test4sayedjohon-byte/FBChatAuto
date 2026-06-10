// ─── Async Message Processing ──────────────────────────────────────────────

import type { Env, FacebookWebhookEvent, FacebookMessagingEvent, WhatsAppWebhookEvent, PageConnection } from './types';
import { createSupabaseAdmin } from './supabase';
import { handleChatMessage, triggerSlidingWindowSummarization } from './chat';
import { sendFacebookReply, sendFacebookSenderAction, getReplyDelay, sendFacebookAttachment } from './facebook';
import { processWhatsAppWebhookEntries } from './whatsapp';
import {
  getPageConnectionFallback,
  getUserRecord,
  getMonthlyMessageCountFallback,
  storeIncomingMessageFallback,
  updateMessageMetadataFallback,
  acquireSessionLockFallback,
  releaseSessionLockFallback,
  getChatSessionFallback,
  getLatestMessageRoleFallback,
  storeAssistantMessageFallback,
  updateChatAssetMediaIdFallback,
  incrementChatAssetTimesSentFallback
} from './db';
import { processCommentChanges } from './comments';
import { processFeedChanges } from './feed-processor';
import { handleFlowInteraction, handleFlowTextInput, executeNode } from './chat/flow-engine';

// ─── Helper: Download Facebook Images to Base64 ─────────────────────────────
// Facebook Messenger webhook image URLs (lookaside.fbsbx.com) are self-authenticating
// signed CDN URLs — they do NOT need the page access token appended.
// They are publicly accessible for ~1 hour after creation.
// We download them immediately on webhook receipt and convert to base64 data URLs
// so that vision AI models (which can't authenticate with Facebook's CDN) can
// receive the image data inline in the API request.

async function downloadFacebookImages(fbImageUrls: string[]): Promise<string[]> {
  const results: string[] = [];
  // Limit: a typical Facebook photo is 100–400KB. In base64 that's ~133–533KB.
  // We cap at 1MB original to avoid bloating the JSON payload to the AI API.
  const MAX_ORIGINAL_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

  for (const url of fbImageUrls) {
    try {
      // Fetch directly — DO NOT append the page access token.
      // Facebook CDN URLs (lookaside.fbsbx.com) are self-signed. Adding a
      // Graph API token would corrupt the URL and return a 400/403.
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FBChatAuto/1.0)' },
        signal: AbortSignal.timeout(8_000), // 8s per image
      });

      if (!response.ok) {
        console.warn(`[Webhook] ⚠️ Failed to download FB image (HTTP ${response.status}). Keeping original URL.`);
        results.push(url);
        continue;
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();

      if (arrayBuffer.byteLength > MAX_ORIGINAL_SIZE_BYTES) {
        console.warn(`[Webhook] ⚠️ FB image too large (${Math.round(arrayBuffer.byteLength / 1024)}KB). Keeping original URL.`);
        results.push(url);
        continue;
      }

      // Convert to base64 data URL so any vision AI model can receive it inline
      const uint8Array = new Uint8Array(arrayBuffer);
      let binaryString = '';
      // Build binary string in chunks to avoid stack overflow on large images
      for (let i = 0; i < uint8Array.length; i += 8192) {
        binaryString += String.fromCharCode(...uint8Array.slice(i, i + 8192));
      }
      const base64 = btoa(binaryString);
      const dataUrl = `data:${contentType};base64,${base64}`;

      console.log(`[Webhook] ✅ FB image → base64 (${Math.round(arrayBuffer.byteLength / 1024)}KB, ${contentType})`);
      results.push(dataUrl);
    } catch (err: any) {
      console.error(`[Webhook] ❌ Error downloading FB image (${err?.message}). Keeping original URL.`);
      results.push(url); // Fall back to original — works if AI can reach it quickly
    }
  }

  return results;
}

// ─── Billing Cycle Calculator ────────────────────────────────────────────────

function calculateBillingCycle(
  registrationDateStr: string | undefined,
  purchases: { created_at: string; status: string; payment_method?: string }[]
) {
  const latestApproved = [...purchases]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .find(p => p.status === 'approved' && p.payment_method !== 'gift');
  
  let cycleAnchor = new Date();
  if (latestApproved) {
    cycleAnchor = new Date(latestApproved.created_at);
  } else if (registrationDateStr) {
    cycleAnchor = new Date(registrationDateStr);
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
 * Helper: Delay for ms milliseconds, checking the check() condition every 100ms.
 * Returns early if check() evaluates to true.
 */
async function delayOrFinish(ms: number, check: () => boolean): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (check()) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
// ─── Main Entry Point ────────────────────────────────────────────────────────

export async function processWebhookEntries(event: FacebookWebhookEvent | WhatsAppWebhookEvent, env: Env, expectedUserId: string): Promise<void> {
  if (event.object === 'whatsapp_business_account') {
    return processWhatsAppWebhookEntries(event as WhatsAppWebhookEvent, env, expectedUserId);
  }
  const supabase = createSupabaseAdmin(env);

  for (const entry of (event as FacebookWebhookEvent).entry) {
    const pageId = entry.id;
    console.log(`[Webhook] Processing entry for page: ${pageId}`);

    if (entry.changes && entry.changes.length > 0) {
      console.log(`[Webhook] Detected changes/comments events in entry for page ${pageId}`);
      const platform = event.object === 'instagram' ? 'instagram' : 'facebook';
      await processCommentChanges(entry.changes, pageId, platform, env, expectedUserId);
      await processFeedChanges(entry.changes, pageId, platform, env);
      continue;
    }

    if (!entry.messaging || entry.messaging.length === 0) {
      console.log(`[Webhook] No messaging or changes events in entry for page ${pageId}`);
      continue;
    }

    const pageConnection = await getPageConnectionFallback(env.DB, supabase, pageId);

    if (!pageConnection) {
      console.warn(`[Webhook] ⚠️ No active page connection found for page ${pageId} — ignoring`);
      continue;
    }
    
    const userRecord = await getUserRecord(env.DB, supabase, pageConnection.user_id);
      
    if (userRecord?.is_suspended) {
      console.log(`[Webhook] 🚫 Tenant ${pageConnection.user_id} is suspended. Ignoring messages.`);
      continue;
    }
      
    if (userRecord?.settings?.is_bot_active === false) {
      console.log(`[Webhook] ⏸️ Service is paused for tenant: ${pageConnection.user_id}. Ignoring messages.`);
      continue;
    }

    if (userRecord?.allowed_channels === undefined || userRecord?.allowed_channels <= 0) {
      console.log(`[Webhook] 🚫 Tenant ${pageConnection.user_id} has 0 allowed channels. Ignoring messages.`);
      continue;
    }

    if (userRecord?.monthly_message_limit !== undefined && userRecord?.monthly_message_limit !== -1) {
      const extraLimit = userRecord.extra_message_limit ?? 0;
      const allowedLimit = userRecord.monthly_message_limit + extraLimit;

      if (allowedLimit <= 0) {
         console.log(`[Webhook] 🚫 Tenant ${pageConnection.user_id} has 0 or less allowed message limit.`);
         continue;
      }
      
      let pHistory: any[] = [];
      try {
        const { data } = await supabase
          .from('purchases')
          .select('created_at, status, payment_method')
          .eq('user_id', pageConnection.user_id);
        pHistory = data || [];
      } catch (err: any) {
        console.warn(`[Failover] Purchases fetch failed for user ${pageConnection.user_id}: ${err.message}. Using default billing anchor.`);
      }

      const { startDate } = calculateBillingCycle(userRecord.created_at, pHistory);

      const messagesCount = await getMonthlyMessageCountFallback(env.DB, supabase, pageConnection.user_id, startDate.toISOString());

      if (messagesCount >= allowedLimit) {
        console.log(`[Webhook] 🚫 Tenant ${pageConnection.user_id} exceeded monthly message limit (${messagesCount}/${allowedLimit}).`);
        continue;
      }
    }

    console.log(`[Webhook] Routed to tenant: ${pageConnection.user_id} (Page: ${pageConnection.page_name})`);

    for (const messagingEvent of entry.messaging) {
      await handleMessagingEvent(supabase, env, pageConnection, messagingEvent);
    }
  }
}

// ─── Per-Message Event Handler ───────────────────────────────────────────────

async function handleMessagingEvent(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  env: Env,
  pageConnection: PageConnection,
  event: FacebookMessagingEvent
): Promise<void> {
  const senderId = event.sender.id;
  const pageId = event.recipient.id;

  if (event.delivery || event.read) return;

  if (senderId === pageConnection.page_id) return;

  const messageText = event.message?.text || '';
  const attachments = event.message?.attachments || [];
  const fbMessageId = event.message?.mid || Date.now().toString();

  const payload = event.postback?.payload || (event.message as any)?.quick_reply?.payload;
  if (payload && payload.startsWith('FLOW_NODE_ID:')) {
    console.log(`[Webhook] 🔘 Button/Quick-Reply flow payload from ${senderId}: ${payload}`);
    const title = event.postback?.title || event.message?.text || 'Option';
    const tappedText = `[Tapped: ${title}]`;

    const result = await storeIncomingMessageFallback(
      env.DB,
      supabase,
      pageConnection.user_id,
      pageId,
      senderId,
      tappedText,
      fbMessageId,
      pageConnection.access_token
    );

    if (result) {
      const handled = await handleFlowInteraction(
        env.DB,
        supabase,
        result.sessionId,
        payload,
        pageConnection,
        senderId
      );
      if (handled) {
        return;
      }
    }
  }

  if (event.postback) {
    console.log(`[Webhook] 🔘 Postback from ${senderId}: ${event.postback.payload}`);
    return;
  }

  if (!messageText && attachments.length === 0) return;

  // ── Categorize attachments ──────────────────────────────────────────────
  const imageUrls: string[] = [];
  const sharedLinks: { title: string; url: string }[] = [];
  let unsupportedCount = 0;

  for (const att of attachments) {
    const attType = (att as any).type;
    const attUrl = (att as any).payload?.url || '';

    if (attType === 'image' && attUrl) {
      imageUrls.push(attUrl);
    } else if (attType === 'fallback') {
      const title = (att as any).payload?.title || (att as any).title || '';
      const url = (att as any).payload?.url || (att as any).url || '';
      if (title || url) sharedLinks.push({ title, url });
    } else {
      unsupportedCount++;
    }
  }

  const hasImage = imageUrls.length > 0;
  const hasSharedLink = sharedLinks.length > 0;
  const hasOnlyUnsupported = unsupportedCount > 0 && !hasImage && !hasSharedLink;

  // ── Build content to store ──────────────────────────────────────────────
  let contentToStore = messageText;

  if (sharedLinks.length > 0) {
    const linkContext = sharedLinks
      .map(l => l.title ? `[Shared: ${l.title}${l.url ? ` — ${l.url}` : ''}]` : `[Shared Link: ${l.url}]`)
      .join('\n');
    contentToStore = contentToStore ? `${contentToStore}\n${linkContext}` : linkContext;
  }

  if (!contentToStore && hasImage) {
    contentToStore = imageUrls.length === 1
      ? '[Attachment: image]'
      : `[Attachment: ${imageUrls.length} images]`;
  } else if (!contentToStore && attachments.length > 0) {
    const allTypes = attachments.map((a: any) => a.type);
    contentToStore = `[Attachment: ${allTypes.join(', ')}]`;
  }

  console.log(`[Webhook] 💬 Message from ${senderId}: "${contentToStore.substring(0, 100)}..." (Images: ${imageUrls.length}, Links: ${sharedLinks.length})`);

  const result = await storeIncomingMessageFallback(
    env.DB,
    supabase,
    pageConnection.user_id,
    pageId,
    senderId,
    contentToStore,
    fbMessageId,
    pageConnection.access_token
  );

  if (!result) return;
  console.log(`[Webhook] ✅ Message stored in session: ${result.sessionId}`);

  // Check if there is an active flow session
  const activeFlow = await env.DB.prepare(
    `SELECT current_node_id FROM chat_session_flows WHERE session_id = ?`
  )
    .bind(result.sessionId)
    .first();

  if (activeFlow && messageText) {
    const handledText = await handleFlowTextInput(env.DB, supabase, result.sessionId, messageText, pageConnection, senderId);
    if (handledText) {
      console.log(`[Flow Engine] Flow advanced via text input`);
      return;
    } else {
      console.log(`[Flow Engine] Mismatched text input during flow. Resending options for node ${activeFlow.current_node_id}`);
      await executeNode(env.DB, supabase, result.sessionId, activeFlow.current_node_id as string, pageConnection, senderId);
      return;
    }
  }

  // ── Download & store images as base64 ─────────────────────────────────
  // This runs BEFORE the AI call so the chat handler reads the base64 data URLs.
  // Facebook CDN URLs expire — base64 ensures the vision model always has the image.
  if (imageUrls.length > 0 && fbMessageId) {
    console.log(`[Webhook] 📥 Downloading ${imageUrls.length} Facebook image(s) for inline vision delivery...`);
    const accessibleUrls = await downloadFacebookImages(imageUrls);
    await updateMessageMetadataFallback(
      env.DB,
      supabase,
      fbMessageId,
      {
        attachment_types: accessibleUrls.map(() => 'image'),
        attachment_urls: accessibleUrls,
      }
    );
    console.log(`[Webhook] ✅ Image metadata saved for message ${fbMessageId}`);
  }

  // ── Debounce period ──────────────────────────────────────────────────────
  // Wait 1.5 seconds to let any companion images/texts arrive and write to DB
  console.log(`[Webhook] ⏳ Debouncing session ${result.sessionId} for 1.5s...`);
  await new Promise(resolve => setTimeout(resolve, 1500));

  // ── Concurrency Lock ─────────────────────────────────────────────────────
  const MAX_LOCK_RETRIES = 5;
  let lockAcquired = false;

  for (let attempt = 0; attempt < MAX_LOCK_RETRIES; attempt++) {
    lockAcquired = await acquireSessionLockFallback(env.DB, supabase, result.sessionId, 30);
    if (lockAcquired) break;
    console.log(`[Webhook] ⏳ Session ${result.sessionId} is locked. Retry ${attempt + 1}/${MAX_LOCK_RETRIES}...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (!lockAcquired) {
    console.warn(`[Webhook] ⚠️ Could not acquire lock for session ${result.sessionId} after ${MAX_LOCK_RETRIES} retries. Skipping.`);
    return;
  }

  let isProcessing = false;
  let typingPromise: Promise<void> = Promise.resolve();

  try {
    // ── Check if bot was paused or already responded to ───────────────────
    const sessionRes = await getChatSessionFallback(env.DB, supabase, result.sessionId);
    const latestMsgRole = await getLatestMessageRoleFallback(env.DB, supabase, result.sessionId);

    if (sessionRes?.bot_paused) {
      console.log(`[Webhook] ⏸️ Bot is paused for session ${result.sessionId}. Skipping AI response.`);
      return;
    }

    if (latestMsgRole && latestMsgRole !== 'user') {
      console.log(`[Webhook] ⏭️ Session ${result.sessionId} was already responded to (latest role: ${latestMsgRole}). Skipping.`);
      return;
    }

    if (!messageText && hasOnlyUnsupported) {
      const cannedResponse = "Thanks for sending that! I can currently only understand text and images. " +
        "If you have a question, please type it out and I'll be happy to help. 😊";
      await sendFacebookReply(pageConnection.access_token, senderId, cannedResponse, pageConnection.page_id);
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
    // ── Trigger Word Detection ──────────────────────────────────────────────
    if (messageText) {
      const triggerWords = Array.isArray(pageConnection.trigger_words) ? pageConnection.trigger_words : [];
      let isTriggerHit = false;
      
      if (pageConnection.is_trigger_enabled && triggerWords.length > 0) {
        const lowerText = messageText.toLowerCase();
        isTriggerHit = triggerWords.some((word: string) => lowerText.includes(word.toLowerCase()));
      }

      if (isTriggerHit) {
        console.log(`[Webhook] 🚨 Trigger word detected for session ${result.sessionId}`);
        const responses = Array.isArray(pageConnection.trigger_responses) && pageConnection.trigger_responses.length > 0
          ? pageConnection.trigger_responses 
          : ["I need to transfer you to a human agent. Please hold on."];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];

        await sendFacebookReply(pageConnection.access_token, senderId, randomResponse, pageConnection.page_id);
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
          console.warn(`[Failover] Failed to update session trigger meta on Supabase: ${err.message}`);
        }
        await env.DB.prepare(`UPDATE chat_sessions SET bot_paused = 1 WHERE id = ?`).bind(result.sessionId).run();
        return;
      }
    }

    // Show typing indicator and mark as seen while AI is processing
    await sendFacebookSenderAction(pageConnection.access_token, senderId, 'mark_seen', pageConnection.page_id);

    isProcessing = true;
    typingPromise = (async () => {
      try {
        while (isProcessing) {
          await sendFacebookSenderAction(pageConnection.access_token, senderId, 'typing_on', pageConnection.page_id);
          // Typing for 3 to 6 seconds
          const typingDuration = Math.floor(Math.random() * 3000) + 3000;
          await delayOrFinish(typingDuration, () => !isProcessing);
          if (!isProcessing) break;

          await sendFacebookSenderAction(pageConnection.access_token, senderId, 'typing_off', pageConnection.page_id);
          // Pause for 1 to 2.5 seconds
          const pauseDuration = Math.floor(Math.random() * 1500) + 1000;
          await delayOrFinish(pauseDuration, () => !isProcessing);
        }
      } catch (err) {
        console.error('[Webhook] ❌ Error in typing simulation loop:', err);
      }
    })();

    // ── Full AI Response Pipeline ───────────────────────────────────────────
    const chatResult = await handleChatMessage(
      supabase,
      result.sessionId,
      pageConnection,
      contentToStore,
      senderId,
      env.DB
    );

    console.log(
      `[Webhook] 🤖 AI response via ${chatResult.provider}/${chatResult.model}` +
      ` | Tokens: ${chatResult.tokensUsed ?? '?'}` +
      ` | RAG: ${chatResult.ragUsed}`
    );

    // Apply human-like randomized delay BEFORE sending the message
    const isVisionCanned = chatResult.provider?.startsWith('vision-') && chatResult.model === 'canned';
    const extraDelayMs = getReplyDelay(chatResult.reply, isVisionCanned);

    if (extraDelayMs > 0) {
      console.log(`[Webhook] ⏳ Adding randomized human-like delay of ${extraDelayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, extraDelayMs));
    }

    // Stop typing simulation and await it to finish
    isProcessing = false;
    await typingPromise;

    // Send final reply
    await sendFacebookReply(pageConnection.access_token, senderId, chatResult.reply, pageConnection.page_id);

    // Send attachment if triggered by AI
    if (chatResult.attachment) {
      console.log(`[Webhook] Sending attachment '${chatResult.attachment.name}' to ${senderId}...`);
      const sendAttRes = await sendFacebookAttachment(
        pageConnection.access_token,
        senderId,
        chatResult.attachment.fileType,
        chatResult.attachment.fileUrl,
        chatResult.attachment.facebookMediaId,
        pageConnection.page_id
      );

      if (sendAttRes.success) {
        // Cache media ID
        if (sendAttRes.mediaId && !chatResult.attachment.facebookMediaId) {
          try {
            if (env.DB) {
              await updateChatAssetMediaIdFallback(env.DB, supabase, chatResult.attachment.id, sendAttRes.mediaId);
            } else {
              await supabase
                .from('chat_assets')
                .update({ facebook_media_id: sendAttRes.mediaId })
                .eq('id', chatResult.attachment.id);
            }
            console.log(`[Webhook] Cached Facebook media ID ${sendAttRes.mediaId} for asset ${chatResult.attachment.name}`);
          } catch (cacheErr) {
            console.error('[Webhook] Failed to cache Facebook media ID:', cacheErr);
          }
        }

        // Increment times_sent
        try {
          if (env.DB) {
            await incrementChatAssetTimesSentFallback(env.DB, supabase, chatResult.attachment.id);
          } else {
            const { data: currentAsset } = await supabase
              .from('chat_assets')
              .select('times_sent')
              .eq('id', chatResult.attachment.id)
              .maybeSingle();
            if (currentAsset) {
              await supabase
                .from('chat_assets')
                .update({ times_sent: (currentAsset.times_sent || 0) + 1 })
                .eq('id', chatResult.attachment.id);
            }
          }
        } catch (sentCountErr) {
          console.error('[Webhook] Failed to increment times_sent:', sentCountErr);
        }

        // Save second message row for attachment send (billing & display)
        const attachmentContent = `[Sent File: ${chatResult.attachment.friendlyName || chatResult.attachment.name}]`;
        const attMetadata = {
          is_attachment_response: true,
          attachment_types: [chatResult.attachment.fileType],
          attachment_urls: [chatResult.attachment.fileUrl],
          facebook_media_id: sendAttRes.mediaId || chatResult.attachment.facebookMediaId
        };

        if (env.DB) {
          await storeAssistantMessageFallback(
            env.DB,
            supabase,
            result.sessionId,
            pageConnection.user_id,
            attachmentContent,
            null,
            attMetadata
          );
        } else {
          await supabase.from('chat_messages').insert({
            session_id: result.sessionId,
            user_id: pageConnection.user_id,
            role: 'assistant',
            content: attachmentContent,
            token_count: null,
            metadata: attMetadata
          });
        }
      }
    }

    try {
      await triggerSlidingWindowSummarization(supabase, result.sessionId, pageConnection, senderId);
    } catch (err: any) {
      console.warn(`[Failover] Summarization failed or skipped during outage: ${err.message}`);
    }
  } finally {
    isProcessing = false;
    await typingPromise;
    // Ensure typing indicator is turned off in case of errors
    await sendFacebookSenderAction(pageConnection.access_token, senderId, 'typing_off', pageConnection.page_id);
    await releaseSessionLockFallback(env.DB, supabase, result.sessionId);
  }
}
