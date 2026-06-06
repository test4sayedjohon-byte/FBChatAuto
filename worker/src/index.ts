// ============================================================================
// Facebook Messenger Webhook — Cloudflare Worker (Hono.js)
// ============================================================================
// Handles webhook verification (GET) and incoming messages (POST).
//
// Flow:
//   1. GET  /webhook → Facebook verification challenge
//   2. POST /webhook → Receive messages, verify signature, route to tenant,
//                       store in DB, generate AI response, send reply.
// ============================================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env, FacebookWebhookEvent, FacebookMessagingEvent } from './types';
import { verifyFacebookSignature } from './verify';
import { createSupabaseAdmin, getPageConnection, storeIncomingMessage } from './supabase';
import { handleChatMessage, triggerSlidingWindowSummarization } from './chat';
import { processDocument } from './rag';

// ─── App Setup ──────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors());

// ─── Health Check & Testing ─────────────────────────────────────────────────

app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'autometabot-webhook',
    version: '2.0.0',
    phase: 2,
    timestamp: new Date().toISOString(),
  });
});

  app.post('/test-chat', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, message, sessionId, pageId } = body;
    
    if (!userId || !message) {
      return c.json({ error: 'Missing userId or message' }, 400);
    }
    
    const supabase = createSupabaseAdmin(c.env);
    
    console.log(`[TestChat] url=${c.env.SUPABASE_URL}, key_len=${c.env.SUPABASE_SERVICE_KEY?.length}`);
    const activeSessionId = sessionId || '00000000-0000-0000-0000-000000000000';
    
    // Call the exact same chat handler used by Facebook
    let pageConnection;
    
    if (pageId) {
      // Fetch the real page connection to use its specific bot name, system prompt, and knowledge base
      pageConnection = await getPageConnection(supabase, pageId);
      if (!pageConnection) {
        return c.json({ error: 'Page connection not found' }, 404);
      }
    } else {
      // Mock a generic page connection for the global test sandbox
      pageConnection = {
        id: 'test-page-conn-id',
        user_id: userId,
        page_id: 'test-sandbox-page',
        page_name: 'Test Sandbox',
        access_token: 'mock-token',
        is_active: true,
        webhook_secret: null,
        bot_name: 'Global Sandbox Bot',
        custom_system_prompt: null,
        ai_model: null,
        temperature: 0.5
      };
    }

    // Store the message to ensure it appears in the session history
    const result = await storeIncomingMessage(
      supabase,
      userId,
      pageConnection.page_id,
      'sandbox_user', // mock sender id
      message,
      `sandbox_${Date.now()}`, // mock fb message id
      pageConnection.access_token || 'mock-token'
    );

    const actualSessionId = result ? result.sessionId : activeSessionId;

    const chatResult = await handleChatMessage(
      supabase,
      actualSessionId,
      pageConnection,
      message,
      'sandbox_user'
    );
    
    // Trigger background summarization for sandbox testing as well
    c.executionCtx.waitUntil(
      triggerSlidingWindowSummarization(
        supabase,
        actualSessionId,
        pageConnection,
        'sandbox_user'
      )
    );
    
    return c.json({
      reply: chatResult.reply,
      provider: chatResult.provider,
      model: chatResult.model,
      ragUsed: chatResult.ragUsed,
      tokensUsed: chatResult.tokensUsed
    });
  } catch (error: any) {
    console.error('[TestChat] Error:', error);
    return c.json({ error: error.message || 'Internal error' }, 500);
  }
});

// ─── Inbox / Human Takeover API ─────────────────────────────────────────────

app.post('/api/chat/toggle-bot', async (c) => {
  try {
    const { sessionId, botPaused } = await c.req.json();
    const supabase = createSupabaseAdmin(c.env);
    
    await supabase.from('chat_sessions').update({ bot_paused: botPaused }).eq('id', sessionId);
    
    return c.json({ success: true, botPaused });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/api/chat/send', async (c) => {
  try {
    const { sessionId, text, pageId, recipientId } = await c.req.json();
    const supabase = createSupabaseAdmin(c.env);

    // 1. Get page connection to get access token
    const pageConnection = await getPageConnection(supabase, pageId);
    if (!pageConnection) throw new Error('Page not found');

    // 2. Send via Facebook API
    await sendFacebookReply(pageConnection.access_token, recipientId, text);

    // 3. Save as human agent message
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: pageConnection.user_id,
      role: 'human_agent',
      content: text,
      fb_message_id: `manual_${Date.now()}`
    });

    // 4. Fetch existing session metadata to clear trigger flag
    const { data: session } = await supabase.from('chat_sessions').select('metadata').eq('id', sessionId).single();
    const existingMetadata = session?.metadata || {};
    if (existingMetadata.has_trigger) {
      delete existingMetadata.has_trigger;
    }

    // 5. Update session: auto pause bot when human replies
    await supabase.from('chat_sessions').update({ 
      last_message_at: new Date().toISOString(),
      bot_paused: true,
      metadata: existingMetadata
    }).eq('id', sessionId);

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/api/documents/process', async (c) => {
  try {
    const { documentId, userId } = await c.req.json();
    const supabase = createSupabaseAdmin(c.env);
    
    // 1. Fetch document
    const { data: doc } = await supabase.from('documents').select('*').eq('id', documentId).single();
    if (!doc || !doc.original_content) throw new Error('Document not found or empty');

    // 2. Get provider
    const { getActiveEmbeddingProvider } = await import('./ai/provider');
    const provider = await getActiveEmbeddingProvider(supabase, userId);
    if (!provider) throw new Error('No embedding provider active for this tenant');

    // 3. Process the document
    const result = await processDocument(supabase, provider, userId, documentId, doc.original_content);
    
    return c.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[Document Process Error]:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ─── Webhook Verification (GET) ────────────────────────────────────────────
// Facebook sends a GET request with a challenge to verify your webhook URL.
// You must respond with the challenge value if the verify token matches.
// @see https://developers.facebook.com/docs/messenger-platform/webhooks#verification

app.get('/webhook/:userId', async (c) => {
  const userId = c.req.param('userId');
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  console.log(`[Webhook] Verification request received for user ${userId}`, { mode, token: token ? '***' : 'missing' });

  const supabase = createSupabaseAdmin(c.env);
  const { data: userData } = await supabase.from('users').select('settings').eq('id', userId).single();
  
  // Use user's verify token, or fallback to platform token if not BYOA
  const expectedToken = userData?.settings?.fb_verify_token || c.env.FB_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[Webhook] ✅ Verification successful');
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  console.warn('[Webhook] ❌ Verification failed — token mismatch');
  return c.text('Forbidden', 403);
});

// ─── Incoming Messages (POST) ──────────────────────────────────────────────
// Facebook sends a POST request for every event (message, postback, etc.).
// We MUST respond with 200 within 20 seconds or Facebook will retry.
// Heavy processing is done asynchronously via `c.executionCtx.waitUntil()`.

app.post('/webhook/:userId', async (c) => {
  const userId = c.req.param('userId');
  const rawBody = await c.req.text();
  
  const supabase = createSupabaseAdmin(c.env);
  const { data: userData } = await supabase.from('users').select('settings').eq('id', userId).single();
  
  // Use user's app secret, or fallback to platform secret if not BYOA
  const expectedSecret = userData?.settings?.fb_app_secret || c.env.FB_APP_SECRET;

  // 1. Verify the request signature
  const signature = c.req.header('X-Hub-Signature-256') ?? null;
  const isValid = await verifyFacebookSignature(rawBody, signature, expectedSecret);

  if (!isValid) {
    console.error(`[Webhook] ❌ Invalid signature for user ${userId} — rejecting request`);
    return c.text('Invalid signature', 403);
  }

  // 2. Parse the event payload
  let event: FacebookWebhookEvent;
  try {
    event = JSON.parse(rawBody) as FacebookWebhookEvent;
  } catch (e) {
    console.error('[Webhook] Failed to parse JSON body');
    return c.text('Bad Request', 400);
  }

  // 3. Ensure this is a Page or Instagram subscription event
  if (event.object !== 'page' && event.object !== 'instagram') {
    console.log(`[Webhook] Ignoring unsupported event object: ${event.object}`);
    return c.json({ status: 'ignored' }, 200);
  }

  // 4. Respond immediately with 200 (Facebook requires < 20s response)
  //    Process messages asynchronously in the background.
  c.executionCtx.waitUntil(processWebhookEntries(event, c.env));

  return c.json({ status: 'received' }, 200);
});

// ─── Async Message Processing ──────────────────────────────────────────────

async function processWebhookEntries(event: FacebookWebhookEvent, env: Env): Promise<void> {
  const supabase = createSupabaseAdmin(env);

  for (const entry of event.entry) {
    const pageId = entry.id;
    console.log(`[Webhook] Processing entry for page: ${pageId}`);

    if (!entry.messaging || entry.messaging.length === 0) {
      console.log(`[Webhook] No messaging events in entry for page ${pageId}`);
      continue;
    }

    // Look up which tenant owns this page
    const pageConnection = await getPageConnection(supabase, pageId);

    if (!pageConnection) {
      console.warn(`[Webhook] ⚠️ No active page connection found for page ${pageId} — ignoring`);
      continue;
    }
    
    const { data: userRecord } = await supabase
      .from('users')
      .select('settings, is_suspended, monthly_message_limit, allowed_channels')
      .eq('id', pageConnection.user_id)
      .single();
      
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
      if (userRecord.monthly_message_limit <= 0) {
         console.log(`[Webhook] 🚫 Tenant ${pageConnection.user_id} has 0 monthly message limit.`);
         continue;
      }
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count: messagesCount, error: countError } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', pageConnection.user_id)
        .gte('created_at', firstDay);

      if (!countError && messagesCount !== null && messagesCount >= userRecord.monthly_message_limit) {
        console.log(`[Webhook] 🚫 Tenant ${pageConnection.user_id} exceeded monthly message limit (${messagesCount}/${userRecord.monthly_message_limit}).`);
        continue;
      }
    }

    console.log(`[Webhook] Routed to tenant: ${pageConnection.user_id} (Page: ${pageConnection.page_name})`);

    // Process each messaging event
    for (const messagingEvent of entry.messaging) {
      await handleMessagingEvent(supabase, env, pageConnection, messagingEvent);
    }
  }
}

async function handleMessagingEvent(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  env: Env,
  pageConnection: NonNullable<Awaited<ReturnType<typeof getPageConnection>>>,
  event: FacebookMessagingEvent
): Promise<void> {
  const senderId = event.sender.id;
  const pageId = event.recipient.id;

  // Skip delivery/read receipts — we only care about actual messages
  if (event.delivery || event.read) {
    return;
  }

  // Skip messages sent BY the page (echo of bot's own messages)
  if (senderId === pageConnection.page_id) {
    return;
  }

  // Handle text messages
  if (event.message?.text) {
    const messageText = event.message.text;
    const fbMessageId = event.message.mid;

    console.log(`[Webhook] 💬 Message from ${senderId}: "${messageText.substring(0, 100)}..."`);

    // Store the message and get/create the session
    const result = await storeIncomingMessage(
      supabase,
      pageConnection.user_id,
      pageId,
      senderId,
      messageText,
      fbMessageId,
      pageConnection.access_token
    );

    if (result) {
      console.log(`[Webhook] ✅ Message stored in session: ${result.sessionId}`);

      // If a human agent has paused the bot, do not generate an AI response
      if (result.botPaused) {
        console.log(`[Webhook] ⏸️ Bot paused for session ${result.sessionId}. Awaiting human agent.`);
        return;
      }

      // ── Phase 1.5: Trigger Word Detection ──────────────────────────
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

        // Send Facebook reply
        await sendFacebookReply(pageConnection.access_token, senderId, randomResponse);

        // Store assistant message
        await supabase.from('chat_messages').insert({
          session_id: result.sessionId,
          user_id: pageConnection.user_id,
          role: 'assistant',
          content: randomResponse,
          metadata: { is_trigger_response: true }
        });

        // Fetch existing metadata to append has_trigger flag
        const { data: sessionData } = await supabase.from('chat_sessions').select('metadata').eq('id', result.sessionId).single();
        const existingMetadata = sessionData?.metadata || {};
        
        // Update session: pause bot, flag trigger in metadata
        await supabase.from('chat_sessions').update({ 
          bot_paused: true,
          metadata: { ...existingMetadata, has_trigger: true }
        }).eq('id', result.sessionId);

        return; // Stop AI generation
      }

      // ── Phase 2: Full AI Response Pipeline ──────────────────────
      const chatResult = await handleChatMessage(
        supabase,
        result.sessionId,
        pageConnection,
        messageText,
        senderId
      );

      console.log(
        `[Webhook] 🤖 AI response via ${chatResult.provider}/${chatResult.model}` +
        ` | Tokens: ${chatResult.tokensUsed ?? '?'}` +
        ` | RAG: ${chatResult.ragUsed}`
      );

      // Send the AI's reply back to Facebook
      await sendFacebookReply(
        pageConnection.access_token,
        senderId,
        chatResult.reply
      );

      // ── Phase 3: Sliding Window Summarization ──────────────────────
      // Triggered in the background (within the waitUntil execution context)
      await triggerSlidingWindowSummarization(
        supabase,
        result.sessionId,
        pageConnection,
        senderId
      );
    }
  }

  // Handle postbacks (button clicks)
  if (event.postback) {
    console.log(`[Webhook] 🔘 Postback from ${senderId}: ${event.postback.payload}`);
    // Future: Handle postback payloads (menu selections, quick replies, etc.)
  }

  // Handle attachments (images, files, etc.)
  if (event.message?.attachments) {
    console.log(`[Webhook] 📎 Attachment from ${senderId}: ${event.message.attachments.length} file(s)`);
    // Future: Handle attachment processing (image recognition, document upload, etc.)
  }
}

// ─── Facebook Graph API: Send Reply ────────────────────────────────────────

async function sendFacebookReply(
  accessToken: string,
  recipientId: string,
  messageText: string
): Promise<void> {
  // Facebook Messenger has a 2000 character limit per message.
  // Split long responses into multiple messages.
  const MAX_LENGTH = 2000;
  const messages = splitMessage(messageText, MAX_LENGTH);

  for (const msg of messages) {
    const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${accessToken}`;

    const payload = {
      recipient: { id: recipientId },
      message: { text: msg },
      messaging_type: 'RESPONSE',
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Facebook] ❌ Failed to send reply (${response.status}):`, errorBody);
      } else {
        console.log(`[Facebook] ✅ Reply sent to ${recipientId}`);
      }
    } catch (error) {
      console.error('[Facebook] ❌ Network error sending reply:', error);
    }
  }
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

    // Find the last space or newline before the limit
    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = maxLength; // Force split at limit
    }

    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks;
}

// ─── Export ─────────────────────────────────────────────────────────────────

export default app;
