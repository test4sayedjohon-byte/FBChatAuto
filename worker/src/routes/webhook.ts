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

// ─── Telegram Webhook Handler (POST) ──────────────────────────────────────────
// Handles updates from our Telegram bot (messages, callbacks, inline buttons).
// We return 200 OK for all events so Telegram doesn't keep retrying on errors.

webhook.post('/webhook-telegram', async (c) => {
  try {
    const body = await c.req.json() as any;
    console.log('[Telegram Webhook] Received payload:', JSON.stringify(body));

    const supabase = createSupabaseAdmin(c.env);

    // 1. Fetch Super Admin config from Supabase
    const { data: superAdmin, error: adminErr } = await supabase
      .from('users')
      .select('id, email, settings')
      .eq('is_super_admin', true)
      .limit(1)
      .maybeSingle();

    if (adminErr || !superAdmin) {
      console.error('[Telegram Webhook] Super admin not found or error:', adminErr);
      return c.json({ error: 'Super Admin configuration missing' }, 200);
    }

    const settings = (superAdmin.settings || {}) as any;
    const botToken = settings.telegram_bot_token;
    const adminChatId = settings.telegram_admin_chat_id;
    const botEnabled = settings.telegram_bot_enabled === true || settings.telegram_bot_enabled === 'true';

    if (!botToken || !adminChatId) {
      console.warn('[Telegram Webhook] Telegram credentials not configured in DB.');
      return c.json({ error: 'Bot credentials missing' }, 200);
    }

    // 2. Handle incoming Message
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text;

      if (text === '/start') {
        const replyText = `👋 <b>Hello!</b>\n\nYour Telegram Chat ID is: <code>${chatId}</code>\n\nPlease copy this Chat ID and send it to me in the chat so I can hardcode it in the backend for you!`;
        
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: replyText,
            parse_mode: 'HTML'
          })
        });
      }
      return c.json({ ok: true });
    }

    // 3. Handle Callback Query (Approve/Reject buttons)
    if (body.callback_query) {
      const callbackQueryId = body.callback_query.id;
      const senderId = body.callback_query.from.id;
      const callbackData = body.callback_query.data; // e.g. "approve:purchase-id"
      const message = body.callback_query.message;
      const messageId = message.message_id;
      const messageChatId = message.chat.id;
      const originalText = message.text || '';

      // Verify sender is the authorized admin
      if (!botEnabled || !adminChatId || String(senderId) !== String(adminChatId)) {
        console.warn(`[Telegram Webhook] Unauthorized attempt from sender ${senderId}`);
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: '❌ Unauthorized. You are not the configured admin.',
            show_alert: true
          })
        });
        return c.json({ ok: true });
      }

      const [action, purchaseId] = callbackData.split(':');
      if (!purchaseId) {
        return c.json({ ok: true });
      }

      // Fetch purchase
      const { data: purchase, error: purchaseErr } = await supabase
        .from('purchases')
        .select('*')
        .eq('id', purchaseId)
        .maybeSingle();

      if (purchaseErr || !purchase) {
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: '❌ Purchase record not found.',
            show_alert: true
          })
        });
        return c.json({ ok: true });
      }

      if (purchase.status !== 'pending') {
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: `⚠️ Request already processed (${purchase.status}).`,
            show_alert: true
          })
        });

        // Remove the inline buttons from the old message
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: messageChatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [] }
          })
        });
        return c.json({ ok: true });
      }

      // Process Action
      if (action === 'approve') {
        const { error: updateErr } = await supabase
          .from('purchases')
          .update({ 
            status: 'approved', 
            admin_notes: 'Approved via Telegram Bot', 
            updated_at: new Date().toISOString() 
          })
          .eq('id', purchaseId);

        if (updateErr) {
          throw updateErr;
        }

        // Log to Billing Ledger
        await supabase.from('billing_ledger').insert({
          id: crypto.randomUUID(),
          user_id: purchase.user_id,
          transaction_type: 'purchase_approved',
          amount: purchase.total_amount,
          currency: purchase.currency,
          description: `Purchase ${purchaseId} approved via Telegram. Channels: +${purchase.channels_count}, Addons: ${purchase.message_addon || ''}`,
          created_at: new Date().toISOString()
        });

        // Edit Telegram message to show approved status
        const updatedText = `${originalText}\n\n✅ <b>Approved via Telegram</b>`;
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: messageChatId,
            message_id: messageId,
            text: updatedText,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [] }
          })
        });

        // Toast in Telegram
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: '✅ Purchase Approved successfully!'
          })
        });
      } else if (action === 'reject') {
        const { error: updateErr } = await supabase
          .from('purchases')
          .update({ 
            status: 'rejected', 
            admin_notes: 'Rejected via Telegram Bot', 
            updated_at: new Date().toISOString() 
          })
          .eq('id', purchaseId);

        if (updateErr) {
          throw updateErr;
        }

        // Edit Telegram message to show rejected status
        const updatedText = `${originalText}\n\n❌ <b>Rejected via Telegram</b>`;
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: messageChatId,
            message_id: messageId,
            text: updatedText,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [] }
          })
        });

        // Toast in Telegram
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: '❌ Purchase Rejected.'
          })
        });
      }
    }

    return c.json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram Webhook Error]:', err);
    return c.json({ error: err.message }, 200);
  }
});

export default webhook;
