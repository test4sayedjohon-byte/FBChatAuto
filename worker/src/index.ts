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
import { createSupabaseAdmin } from './supabase';
import { handleChatMessage, triggerSlidingWindowSummarization } from './chat';
import { runFollowUpSweeper } from './chat/follow-up';
import apiRoutes from './routes/api';
import webhookRoutes from './routes/webhook';
import backupRoutes from './routes/backup';
import {
  getPageConnectionFallback,
  storeIncomingMessageFallback,
  updateMessageMetadataFallback,
  syncOfflineMessages
} from './db';
import { runSchedulerJobs, runTokenHealthChecks, cleanupOrphanedStorageAssets } from './scheduler';
import { processSocialPosterQueue } from './queue-processor';

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
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]' || url.hostname === '::1' || c.env.IS_LOCAL_DEV === 'true';
  console.log(`[Bypass Debug] hostname=${url.hostname}, x-bypass=${c.req.header('X-Bypass-Auth')}`);
  if (isLocal && c.req.header('X-Bypass-Auth') === 'true') {
    const bypassUserId = c.req.header('X-Bypass-User-Id') || 'e71afde7-ec06-4c0d-9982-3e665e294817';
    c.set('authUser', { id: bypassUserId, email: 'test@example.com' });
    return await next();
  }
  return await requireAuth(c, next);
});

app.use('/test-chat', async (c, next) => {
  const url = new URL(c.req.url);
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]' || url.hostname === '::1' || c.env.IS_LOCAL_DEV === 'true';
  if (isLocal && c.req.header('X-Bypass-Auth') === 'true') {
    const bypassUserId = c.req.header('X-Bypass-User-Id') || 'e71afde7-ec06-4c0d-9982-3e665e294817';
    c.set('authUser', { id: bypassUserId, email: 'test@example.com' });
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

// Branded Media Redirect
app.get('/media/:idOrName', async (c) => {
  const param = c.req.param('idOrName');
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);

  // 1. Try D1 Local Cache first
  if (c.env.DB) {
    try {
      const query = isUuid
        ? 'SELECT file_url FROM media WHERE id = ? LIMIT 1'
        : 'SELECT file_url FROM media WHERE name = ? ORDER BY created_at DESC LIMIT 1';
      const row = await c.env.DB.prepare(query).bind(param).first();
      if (row?.file_url) {
        return c.redirect(row.file_url as string);
      }
    } catch (e: any) {
      console.warn(`[Redirect] D1 lookup failed for ${param}:`, e.message);
    }
  }

  // 2. Try Supabase
  try {
    const supabase = createSupabaseAdmin(c.env);
    let query = supabase.from('media').select('file_url');
    if (isUuid) {
      query = query.eq('id', param);
    } else {
      query = query.eq('name', param).order('created_at', { ascending: false }).limit(1);
    }
    const { data } = await query.maybeSingle();
    if (data?.file_url) {
      return c.redirect(data.file_url);
    }
  } catch (e: any) {
    console.error(`[Redirect] Supabase lookup failed for ${param}:`, e.message);
  }

  return c.text('Media file not found', 404);
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
      pageConnection = await getPageConnectionFallback(c.env.DB, supabase, pageId);
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
    const result = await storeIncomingMessageFallback(
      c.env.DB,
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
      await updateMessageMetadataFallback(
        c.env.DB,
        supabase,
        fbMessageId,
        {
          attachment_types: attachmentUrls.map(() => 'image'),
          attachment_urls: attachmentUrls
        }
      );
    }

    const chatResult = await handleChatMessage(
      supabase,
      actualSessionId,
      pageConnection,
      contentToStore,
      senderId,
      c.env.DB
    );
    
    // Trigger background summarization for sandbox testing as well
    c.executionCtx.waitUntil(
      (async () => {
        try {
          await triggerSlidingWindowSummarization(
            supabase,
            actualSessionId,
            pageConnection,
            'sandbox_user'
          );
        } catch (err: any) {
          console.warn(`[Failover] Summarization skipped in test-chat: ${err.message}`);
        }
      })()
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
app.route('/api/super-admin/backup', backupRoutes);
app.route('', webhookRoutes);

// ─── Export ─────────────────────────────────────────────────────────────────

export default {
  fetch: app.fetch,
  async queue(batch: any, env: AppEnv["Bindings"]): Promise<void> {
    if (batch.queue === 'social-poster-queue') {
      await processSocialPosterQueue(batch, env);
    }
  },
  async scheduled(event: any, env: AppEnv["Bindings"], ctx: any) {
    const supabase = createSupabaseAdmin(env);

    // 1. Sync any unsynced offline messages from D1 to Supabase
    try {
      if (env.DB) {
        await syncOfflineMessages(env.DB, supabase);
      }
    } catch (syncErr: any) {
      console.error('[Cron] Offline message sync failed:', syncErr.message);
    }
    
    // 2. Sweeper: Summarize leftover messages (wrapped to handle outages safely)
    try {
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

      // NOTE: Do NOT 'return' here — that would skip steps 3-5 below!
      if (sessions && sessions.length > 0) {
        // Limit to at most 3 sessions per cron run to avoid hitting Cloudflare's 50 subrequest limit
        const sessionsToSweep = sessions.slice(0, 3);

        for (const session of sessionsToSweep) {
          // get pageConnection
          const pageConnection = await getPageConnectionFallback(env.DB, supabase, session.page_id);
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
    } catch (cronErr: any) {
      console.warn(`[Cron] Summarization sweep skipped due to connectivity issue: ${cronErr.message}`);
    }

    // 2.2. Follow-Up Sweeper: Check and send automated follow-up nudges
    try {
      await runFollowUpSweeper(supabase, env);
    } catch (followUpErr: any) {
      console.error('[Cron] Follow-up sweeper failed:', followUpErr.message);
    }

    // 2.5. Storage Backup Sync: Upload pending media assets to R2/Drive
    try {
      const { syncPendingBackups } = await import('./utils/backup');
      const backupCount = await syncPendingBackups(supabase, env);
      if (backupCount > 0) {
        console.log(`[Cron] Backed up ${backupCount} pending media files.`);
      }
    } catch (backupErr: any) {
      console.error('[Cron] Backup synchronization failed:', backupErr.message);
    }

    // 3. Post Scheduler: Publish due posts
    try {
      await runSchedulerJobs(supabase);
    } catch (schedulerErr: any) {
      console.error('[Cron] Post Scheduler job failed:', schedulerErr.message);
    }

    // 4. Token Health: Check page tokens health
    try {
      await runTokenHealthChecks(supabase);
    } catch (healthErr: any) {
      console.error('[Cron] Token Health check failed:', healthErr.message);
    }

    // 4.5. Storage Sweeper: Only run every other tick (every ~10 min) to avoid subrequest overload
    // The storage cleanup alone uses many subrequests; combined with other tasks it hits Cloudflare's limit.
    const scheduledMinute = new Date(event.scheduledTime).getMinutes();
    if (scheduledMinute % 10 === 0) {
      try {
        await cleanupOrphanedStorageAssets(supabase);
      } catch (cleanupErr: any) {
        console.error('[Cron] Storage cleanup sweeper failed:', cleanupErr.message);
      }
    }

    // 5. Weekly content generation scheduling (Auto Mode)
    try {
      if (env.SOCIAL_POSTER_QUEUE) {
        const { data: autoUsers, error: userErr } = await supabase
          .from('users')
          .select('id, settings')
          .eq('settings->>auto_mode', 'true');

        if (userErr) {
          console.error('[Cron] Error fetching auto mode users:', userErr.message);
        } else if (autoUsers && autoUsers.length > 0) {
          const now = Date.now();
          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

          for (const user of autoUsers) {
            const settings = (user.settings || {}) as any;
            const lastGen = settings.last_auto_generation_at ? new Date(settings.last_auto_generation_at).getTime() : 0;

            if (now - lastGen >= sevenDaysMs) {
              console.log(`[Cron] Queueing weekly auto content generation for user: ${user.id}`);
              // Queue an auto-planning task for each such user
              await env.SOCIAL_POSTER_QUEUE.send({
                task: 'generate_ideas',
                tenantId: user.id
              });

              // Update user settings with last_auto_generation_at
              const updatedSettings = {
                ...settings,
                last_auto_generation_at: new Date().toISOString()
              };
              await supabase
                .from('users')
                .update({ settings: updatedSettings })
                .eq('id', user.id);
            }
          }
        }
      } else {
        console.warn('[Cron] SOCIAL_POSTER_QUEUE binding is not configured.');
      }
    } catch (autoErr: any) {
      console.error('[Cron] Weekly auto generation check failed:', autoErr.message);
    }
  }
};
