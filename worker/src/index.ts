// ============================================================================
// Facebook Messenger Webhook — Cloudflare Worker (Hono.js)
// ============================================================================
// Slim entry point — route handlers live in separate modules.
// ============================================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { AppEnv } from './types';
import { requireAuth } from './middleware/auth';
import { createSupabaseAdmin, getPageConnection, storeIncomingMessage } from './supabase';
import { handleChatMessage, triggerSlidingWindowSummarization } from './chat';
import apiRoutes from './routes/api';
import webhookRoutes from './routes/webhook';

// ─── App Setup ──────────────────────────────────────────────────────────────

const app = new Hono<AppEnv>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => {
    // Allow requests from your dashboard (production + local dev)
    const allowed = [
      'https://autofb.junoverseai.com',
      'http://localhost:5173',
      'http://localhost:4173',
    ];
    // Return the origin if it's in the allowlist, otherwise return null (blocked)
    return allowed.includes(origin) ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// ─── JWT Auth for Protected Routes ──────────────────────────────────────────
// All /api/* and /test-chat routes require a valid Supabase JWT.
// Webhook routes (/webhook/*) are NOT protected here — they use Facebook's
// own X-Hub-Signature-256 verification.

app.use('/api/*', async (c, next) => {
  const url = new URL(c.req.url);
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (isLocal && c.req.header('X-Bypass-Auth') === 'true') {
    c.set('authUser', { id: 'e71afde7-ec06-4c0d-9982-3e665e294817', email: 'test@example.com' });
    return await next();
  }
  return await requireAuth(c, next);
});

app.use('/test-chat', async (c, next) => {
  const url = new URL(c.req.url);
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (isLocal && c.req.header('X-Bypass-Auth') === 'true') {
    c.set('authUser', { id: 'e71afde7-ec06-4c0d-9982-3e665e294817', email: 'test@example.com' });
    return await next();
  }
  return await requireAuth(c, next);
});

// ─── Health Check ───────────────────────────────────────────────────────────

app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'autometabot-webhook',
    version: '2.1.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Test Chat (inline — special sandbox route) ─────────────────────────────

  app.post('/test-chat', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, message, sessionId, pageId, attachmentUrls } = body;
    
    if (!userId || (!message && (!attachmentUrls || attachmentUrls.length === 0))) {
      return c.json({ error: 'Missing userId, message or attachments' }, 400);
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

    let contentToStore = message || '';
    if (!contentToStore && attachmentUrls && attachmentUrls.length > 0) {
      contentToStore = attachmentUrls.length === 1
        ? '[Attachment: image]'
        : `[Attachment: ${attachmentUrls.length} images]`;
    }

    const fbMessageId = `sandbox_${Date.now()}`;

    const senderId = `sandbox_${activeSessionId}`;

    // Store the message to ensure it appears in the session history
    const result = await storeIncomingMessage(
      supabase,
      userId,
      pageConnection.page_id,
      senderId, // session-specific mock sender id
      contentToStore,
      fbMessageId, // mock fb message id
      pageConnection.access_token || 'mock-token'
    );

    const actualSessionId = result ? result.sessionId : activeSessionId;

    if (result && attachmentUrls && attachmentUrls.length > 0) {
      await supabase
        .from('chat_messages')
        .update({
          metadata: {
            attachment_types: attachmentUrls.map(() => 'image'),
            attachment_urls: attachmentUrls
          }
        })
        .eq('fb_message_id', fbMessageId);
    }

    const chatResult = await handleChatMessage(
      supabase,
      actualSessionId,
      pageConnection,
      contentToStore,
      senderId
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

// ─── Mount Route Modules ────────────────────────────────────────────────────

app.route('/api', apiRoutes);
app.route('', webhookRoutes);

// ─── Export ─────────────────────────────────────────────────────────────────

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: AppEnv["Bindings"], ctx: any) {
    const supabase = createSupabaseAdmin(env);
    
    // We want sessions where last activity was > 2 hours ago, 
    // but < 4 hours ago (so we don't sweep the whole database every time)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    
    // Find candidate sessions
    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('id, page_id, sender_id, user_id, last_message_at')
      .lt('last_message_at', twoHoursAgo)
      .gt('last_message_at', fourHoursAgo);

    if (!sessions || sessions.length === 0) return;

    for (const session of sessions) {
      // get pageConnection
      const pageConnection = await getPageConnection(supabase, session.page_id);
      if (!pageConnection || !pageConnection.enable_customer_profiling) continue;

      // check message count
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id);

      // If perfectly summarized or 0, skip
      if (!count || count % 10 === 0) continue; 

      console.log(`[Cron] Summarizing leftover messages for session ${session.id}`);
      // Summarize leftover
      await triggerSlidingWindowSummarization(supabase, session.id, pageConnection, session.sender_id, true);
    }
  }
};
