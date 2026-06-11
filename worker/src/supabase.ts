// ============================================================================
// Supabase Client Factory
// ============================================================================
// Creates a Supabase client configured with the service_role key.
// The service role bypasses RLS — required for the webhook worker
// which needs cross-tenant access to route messages.
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Env, PageConnection } from './types';

/**
 * Create a Supabase admin client (service_role, bypasses RLS).
 * This should only be used in the Worker — never expose the service key to the frontend.
 */
export function createSupabaseAdmin(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Look up a page connection by Facebook Page ID.
 * This is the critical multi-tenant routing function:
 * incoming webhook → page_id → user_id (tenant).
 */
export async function getPageConnection(
  supabase: SupabaseClient,
  pageId: string
): Promise<PageConnection | null> {
  const { data, error } = await supabase
    .from('page_connections')
    .select('*')
    .or(`page_id.eq.${pageId},instagram_account_id.eq.${pageId},whatsapp_phone_number_id.eq.${pageId}`)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error(`[Supabase] Error fetching page connection for ${pageId}:`, error.message);
    return null;
  }

  const conn = data as PageConnection;
  if (conn.instagram_account_id === pageId) {
    if (!conn.is_instagram_active) return null;
  } else if (conn.whatsapp_phone_number_id === pageId) {
    if (!conn.is_whatsapp_active) return null;
  } else {
    if (!conn.is_active) return null;
  }

  return conn;
}

/**
 * Look up a page connection by WhatsApp Phone Number ID.
 */
export async function getWhatsAppConnection(
  supabase: SupabaseClient,
  phoneNumberId: string
): Promise<PageConnection | null> {
  const { data, error } = await supabase
    .from('page_connections')
    .select('*')
    .eq('whatsapp_phone_number_id', phoneNumberId)
    .eq('is_whatsapp_active', true)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error(`[Supabase] Error fetching WhatsApp connection for ${phoneNumberId}:`, error.message);
    return null;
  }

  return data as PageConnection;
}

/**
 * Store an incoming message in the database.
 * Handles session resolution and message insertion in one flow.
 */
export async function storeIncomingMessage(
  supabase: SupabaseClient,
  userId: string,
  pageId: string,
  senderId: string,
  messageText: string,
  fbMessageId: string,
  accessToken?: string
): Promise<{ sessionId: string, botPaused: boolean } | null> {
  // 1. Get or create the active session via the DB function
  const { data: sessionData, error: sessionError } = await supabase.rpc(
    'get_or_create_session',
    {
      p_page_id: pageId,
      p_sender_id: senderId,
      p_user_id: userId,
      p_session_timeout: 1800, // 30 minutes default
    }
  );

  if (sessionError || !sessionData?.o_session_id) {
    console.error('[Supabase] Failed to get/create session:', sessionError?.message);
    return null;
  }

  const sessionId = sessionData.o_session_id;
  const botPaused = sessionData.o_bot_paused;

  // 2. Check for duplicate message (Facebook can retry webhooks).
  //    We do a pre-check first as an optimisation, but the real safety net
  //    is the UNIQUE index on fb_message_id at the DB level below.
  const { data: existing } = await supabase
    .from('chat_messages')
    .select('id')
    .eq('fb_message_id', fbMessageId)
    .maybeSingle();

  if (existing) {
    console.log(`[Webhook] Duplicate message ${fbMessageId} detected (pre-check), skipping`);
    return null; // Return null so the worker doesn't process it again
  }

  // 3. Insert the user's message.
  //    The DB has a partial UNIQUE index on fb_message_id (WHERE fb_message_id IS NOT NULL).
  //    If a concurrent worker already inserted this exact message, Postgres throws error code
  //    23505 (unique_violation). We treat this as a safe duplicate and bail out.
  const { error: insertError } = await supabase.from('chat_messages').insert({
    session_id: sessionId,
    user_id: userId,
    role: 'user',
    content: messageText,
    fb_message_id: fbMessageId,
  });

  if (insertError) {
    // 23505 = unique_violation — another worker already inserted this message
    if ((insertError as any).code === '23505') {
      console.log(`[Webhook] Duplicate message ${fbMessageId} rejected by DB unique constraint, skipping`);
      return null;
    }
    console.error('[Supabase] Failed to insert message:', insertError.message);
    return null;
  }

  // 4. Update session last activity and potentially fetch profile
  const { data: sessionInfo } = await supabase
    .from('chat_sessions')
    .select('sender_name, unread_count')
    .eq('id', sessionId)
    .single();

  let updatePayload: any = {
    last_message_at: new Date().toISOString(),
    unread_count: (sessionInfo?.unread_count || 0) + 1,
  };

  if (!sessionInfo?.sender_name && accessToken) {
    try {
      const fbRes = await fetch(`https://graph.facebook.com/v21.0/${senderId}?fields=first_name,last_name,profile_pic`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (fbRes.ok) {
        const fbData: any = await fbRes.json();
        if (fbData.first_name || fbData.last_name) {
          updatePayload.sender_name = `${fbData.first_name || ''} ${fbData.last_name || ''}`.trim();
        }
        if (fbData.profile_pic) {
          updatePayload.sender_avatar = fbData.profile_pic;
        }
      } else {
        const fbErrText = await fbRes.text();
        console.warn(`[Facebook Profile] ${senderId} lookup failed (${fbRes.status}) — apply for 'Business Asset User Profile Access' in Meta App Review. Error: ${fbErrText.slice(0, 200)}`);
      }
    } catch (e) {
      console.error('[Facebook/Instagram] Error fetching profile:', e);
    }
  }

  await supabase
    .from('chat_sessions')
    .update(updatePayload)
    .eq('id', sessionId);

  return { sessionId, botPaused };
}

// ============================================================================
// Session Concurrency Lock Helpers
// ============================================================================
// These prevent two concurrent Cloudflare Worker invocations from processing
// the same chat session at the same time, avoiding double AI replies.

/**
 * Attempt to acquire an exclusive processing lock on a chat session.
 * Returns true if the lock was granted, false if another worker holds it.
 * The lock auto-expires after `durationSeconds` to prevent deadlocks.
 */
export async function acquireSessionLock(
  supabase: SupabaseClient,
  sessionId: string,
  durationSeconds: number = 30
): Promise<boolean> {
  const { data, error } = await supabase.rpc('acquire_session_lock', {
    p_session_id: sessionId,
    p_lock_duration: durationSeconds,
  });

  if (error) {
    console.error('[Supabase] Failed to acquire session lock:', error.message);
    // On error, allow processing to continue rather than blocking everything
    return true;
  }

  return data === true;
}

/**
 * Release the processing lock on a chat session.
 * Always call this in a `finally` block after processing is complete.
 */
export async function releaseSessionLock(
  supabase: SupabaseClient,
  sessionId: string
): Promise<void> {
  const { error } = await supabase.rpc('release_session_lock', {
    p_session_id: sessionId,
  });

  if (error) {
    console.error('[Supabase] Failed to release session lock:', error.message);
  }
}
