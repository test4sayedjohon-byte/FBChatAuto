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
    .eq('page_id', pageId)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error(`[Supabase] Error fetching page connection for ${pageId}:`, error.message);
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

  // 2. Check for duplicate message (Facebook can retry webhooks)
  const { data: existing } = await supabase
    .from('chat_messages')
    .select('id')
    .eq('fb_message_id', fbMessageId)
    .maybeSingle();

  if (existing) {
    console.log(`[Webhook] Duplicate message ${fbMessageId}, skipping`);
    return { sessionId, botPaused };
  }

  // 3. Insert the user's message
  const { error: insertError } = await supabase.from('chat_messages').insert({
    session_id: sessionId,
    user_id: userId,
    role: 'user',
    content: messageText,
    fb_message_id: fbMessageId,
  });

  if (insertError) {
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
      const fbRes = await fetch(`https://graph.facebook.com/v21.0/${senderId}?fields=first_name,last_name,profile_pic&access_token=${accessToken}`);
      if (fbRes.ok) {
        const fbData: any = await fbRes.json();
        if (fbData.first_name || fbData.last_name) {
          updatePayload.sender_name = `${fbData.first_name || ''} ${fbData.last_name || ''}`.trim();
        }
        if (fbData.profile_pic) {
          updatePayload.sender_avatar = fbData.profile_pic;
        }
      }
    } catch (e) {
      console.error('[Facebook] Error fetching profile:', e);
    }
  }

  await supabase
    .from('chat_sessions')
    .update(updatePayload)
    .eq('id', sessionId);

  return { sessionId, botPaused };
}
