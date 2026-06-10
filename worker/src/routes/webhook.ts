// ─── Webhook Routes ────────────────────────────────────────────────────────

import { Hono } from 'hono';
import type { AppEnv, FacebookWebhookEvent, WhatsAppWebhookEvent } from '../types';
import { verifyFacebookSignature } from '../verify';
import { createSupabaseAdmin } from '../supabase';
import { processWebhookEntries } from '../webhook-processor';
import { getUsersForVerification } from '../db';

const webhook = new Hono<AppEnv>();

// ─── Webhook Verification (GET) ────────────────────────────────────────────
// Facebook sends a GET request with a challenge to verify your webhook URL.
// You must respond with the challenge value if the verify token matches.
// @see https://developers.facebook.com/docs/messenger-platform/webhooks#verification

webhook.get('/webhook/:userId', async (c) => {
  const userId = c.req.param('userId');
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  console.log(`[Webhook] Verification request received for user ${userId}`, { mode, token: token ? '***' : 'missing' });

  const supabase = createSupabaseAdmin(c.env);
  const users = await getUsersForVerification(c.env.DB, supabase, userId);
  
  const userData = users?.find((u: any) => u.id === userId);
  const superAdminData = users?.find((u: any) => u.role === 'super_admin');
  
  // Use user's verify token, fallback to super admin settings, or fallback to platform token if not BYOA
  const expectedToken = userData?.settings?.fb_verify_token || superAdminData?.settings?.fb_verify_token || c.env.FB_VERIFY_TOKEN;

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

webhook.post('/webhook/:userId', async (c) => {
  const userId = c.req.param('userId');
  const rawBody = await c.req.text();
  
  const supabase = createSupabaseAdmin(c.env);
  const users = await getUsersForVerification(c.env.DB, supabase, userId);

  
  const userData = users?.find((u: any) => u.id === userId);
  const superAdminData = users?.find((u: any) => u.role === 'super_admin');
  
  // Use user's app secret, fallback to super admin settings, or fallback to platform secret if not BYOA
  const expectedSecret = userData?.settings?.fb_app_secret || superAdminData?.settings?.fb_app_secret || c.env.FB_APP_SECRET;

  // 1. Verify the request signature
  const signature = c.req.header('X-Hub-Signature-256') ?? null;
  const url = new URL(c.req.url);
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]' || url.hostname === '::1';
  console.log(`[Webhook Debug] url.url=${c.req.url} url.hostname=${url.hostname} isLocal=${isLocal} signature=${signature}`);
  let isValid = false;

  if (isLocal && !signature) {
    console.log(`[Webhook] ⚠️ Bypassing signature verification for local testing`);
    isValid = true;
  } else {
    isValid = await verifyFacebookSignature(rawBody, signature, expectedSecret);
  }

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

  // 3. Ensure this is a Page, Instagram, or WhatsApp subscription event
  if (
    event.object !== 'page' &&
    event.object !== 'instagram' &&
    event.object !== 'whatsapp_business_account'
  ) {
    console.log(`[Webhook] Ignoring unsupported event object: ${event.object}`);
    return c.json({ status: 'ignored' }, 200);
  }

  // 4. Respond immediately with 200 (Facebook requires < 20s response)
  //    Process messages asynchronously in the background.
  //    processWebhookEntries internally routes to the WhatsApp handler
  //    when event.object === 'whatsapp_business_account'.
  c.executionCtx.waitUntil(processWebhookEntries(event as FacebookWebhookEvent | WhatsAppWebhookEvent, c.env, userId));

  return c.json({ status: 'received' }, 200);
});

export default webhook;
