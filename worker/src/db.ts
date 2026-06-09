import type { SupabaseClient } from '@supabase/supabase-js';
import type { PageConnection } from './types';

let d1Initialized = false;

/**
 * Ensures that all necessary tables exist in Cloudflare D1.
 * Runs once per worker container instance.
 */
export async function ensureD1Initialized(db: D1Database): Promise<void> {
  if (d1Initialized) return;
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        settings TEXT,
        role TEXT,
        is_suspended INTEGER,
        monthly_message_limit INTEGER,
        extra_message_limit INTEGER DEFAULT 0,
        allowed_channels INTEGER,
        created_at TEXT,
        monthly_token_limit INTEGER,
        strict_token_enforcement INTEGER,
        allow_vision INTEGER DEFAULT 0,
        vision_monthly_limit INTEGER DEFAULT 30,
        vision_queries_used INTEGER DEFAULT 0,
        vision_extra_queries INTEGER DEFAULT 0,
        vision_usage_month TEXT,
        agent_monthly_limit INTEGER DEFAULT 0,
        agent_queries_used INTEGER DEFAULT 0,
        agent_extra_queries INTEGER DEFAULT 0,
        agent_usage_month TEXT,
        assigned_chat_provider_id TEXT,
        assigned_embedding_provider_id TEXT,
        assigned_summarization_provider_id TEXT,
        assigned_agent_provider_id TEXT,
        assigned_vision_provider_id TEXT
      );

      CREATE TABLE IF NOT EXISTS page_connections (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        page_id TEXT,
        page_name TEXT,
        access_token TEXT,
        is_active INTEGER,
        webhook_secret TEXT,
        bot_name TEXT,
        custom_system_prompt TEXT,
        ai_model TEXT,
        temperature REAL,
        ai_provider_id TEXT,
        enable_customer_profiling INTEGER,
        whatsapp_phone_number_id TEXT,
        whatsapp_business_account_id TEXT,
        is_whatsapp_active INTEGER
      );

      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        page_id TEXT,
        sender_id TEXT,
        bot_paused INTEGER DEFAULT 0,
        sender_name TEXT,
        sender_avatar TEXT,
        status TEXT DEFAULT 'open',
        last_message_at TEXT,
        unread_count INTEGER DEFAULT 0,
        message_count INTEGER DEFAULT 0,
        metadata TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        user_id TEXT,
        role TEXT,
        content TEXT,
        fb_message_id TEXT UNIQUE,
        created_at TEXT,
        token_count INTEGER,
        metadata TEXT,
        synced_to_supabase INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS ai_providers (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        provider_name TEXT,
        display_name TEXT,
        base_url TEXT,
        api_key TEXT,
        model_chat TEXT,
        model_embedding TEXT,
        is_active_chat INTEGER,
        is_active_embedding INTEGER,
        is_active_summarization INTEGER,
        is_active_agent INTEGER,
        is_active_vision INTEGER,
        is_global INTEGER,
        fallback_chat_order INTEGER,
        fallback_agent_order INTEGER,
        fallback_summarize_order INTEGER,
        fallback_vision_order INTEGER,
        fallback_embedding_order INTEGER,
        extra_headers TEXT,
        max_tokens INTEGER,
        temperature REAL,
        context_window INTEGER
      );

      CREATE TABLE IF NOT EXISTS knowledge_fields (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        field_name TEXT,
        field_value TEXT,
        category TEXT,
        value_type TEXT,
        display_label TEXT,
        description TEXT,
        page_id TEXT,
        sort_order INTEGER,
        is_active INTEGER
      );

      CREATE TABLE IF NOT EXISTS customer_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        page_id TEXT,
        sender_id TEXT,
        summary TEXT,
        metadata TEXT
      );
    `;

    const statements = sql.split(';').map(s => s.trim()).filter(s => s);
    for (const stmt of statements) {
      await db.exec(stmt.replaceAll(/\n/gm, ' '));
    }
    d1Initialized = true;
    console.log('[D1] Database initialized successfully');
  } catch (err) {
    console.error('[D1] Error initializing database tables:', err);
  }
}

// Helper to safely parse JSON
function safeJsonParse(val: any): any {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (_) {
    return val;
  }
}

// ─── Users Failover ──────────────────────────────────────────────────────────

export async function getUsersForVerification(
  db: D1Database,
  supabase: SupabaseClient,
  userId: string
): Promise<any[]> {
  await ensureD1Initialized(db);
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, settings, role')
      .or(`id.eq.${userId},role.eq.super_admin`);

    if (error) throw error;
    if (data && data.length > 0) {
      // Replicate on read
      for (const user of data) {
        await db.prepare(
          `INSERT OR REPLACE INTO users (id, settings, role) VALUES (?, ?, ?)`
        )
          .bind(user.id, JSON.stringify(user.settings), user.role)
          .run();
      }
      return data;
    }
  } catch (err: any) {
    console.warn(`[Failover] Supabase users query failed: ${err.message}. Trying D1 fallback.`);
  }

  // Fallback to D1
  const { results } = await db.prepare(
    `SELECT id, settings, role FROM users WHERE id = ? OR role = 'super_admin'`
  )
    .bind(userId)
    .all();

  return results.map(r => ({
    id: r.id,
    role: r.role,
    settings: safeJsonParse(r.settings)
  }));
}

export async function getUserRecord(
  db: D1Database,
  supabase: SupabaseClient,
  userId: string
): Promise<any> {
  await ensureD1Initialized(db);
  try {
    const { data, error } = await supabase
      .from('users')
      .select('settings, is_suspended, monthly_message_limit, extra_message_limit, allowed_channels, created_at, monthly_token_limit, strict_token_enforcement')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      // Replicate on read
      await db.prepare(
        `INSERT OR REPLACE INTO users (id, settings, is_suspended, monthly_message_limit, extra_message_limit, allowed_channels, created_at, monthly_token_limit, strict_token_enforcement)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          userId,
          JSON.stringify(data.settings),
          data.is_suspended ? 1 : 0,
          data.monthly_message_limit ?? null,
          data.extra_message_limit ?? null,
          data.allowed_channels ?? null,
          data.created_at ?? null,
          data.monthly_token_limit ?? null,
          data.strict_token_enforcement ? 1 : 0
        )
          .run();
      return data;
    }
  } catch (err: any) {
    console.warn(`[Failover] Supabase user settings query failed: ${err.message}. Trying D1 fallback.`);
  }

  // Fallback to D1
  const row = await db.prepare(
    `SELECT * FROM users WHERE id = ?`
  )
    .bind(userId)
    .first();

  if (!row) return null;

  return {
    id: row.id,
    settings: safeJsonParse(row.settings),
    is_suspended: row.is_suspended === 1,
    monthly_message_limit: row.monthly_message_limit,
    extra_message_limit: row.extra_message_limit,
    allowed_channels: row.allowed_channels,
    created_at: row.created_at,
    monthly_token_limit: row.monthly_token_limit,
    strict_token_enforcement: row.strict_token_enforcement === 1
  };
}

// ─── Page Connections Failover ───────────────────────────────────────────────

function mapConnectionRow(row: any): PageConnection {
  return {
    id: row.id,
    user_id: row.user_id,
    page_id: row.page_id,
    page_name: row.page_name,
    access_token: row.access_token,
    is_active: row.is_active === 1 || row.is_active === true,
    webhook_secret: row.webhook_secret,
    bot_name: row.bot_name,
    custom_system_prompt: row.custom_system_prompt,
    ai_model: row.ai_model,
    temperature: row.temperature,
    ai_provider_id: row.ai_provider_id,
    enable_customer_profiling: row.enable_customer_profiling === 1 || row.enable_customer_profiling === true,
    whatsapp_phone_number_id: row.whatsapp_phone_number_id,
    whatsapp_business_account_id: row.whatsapp_business_account_id,
    is_whatsapp_active: row.is_whatsapp_active === 1 || row.is_whatsapp_active === true,
  };
}

async function cachePageConnection(db: D1Database, conn: PageConnection) {
  await db.prepare(
    `INSERT OR REPLACE INTO page_connections (
      id, user_id, page_id, page_name, access_token, is_active, webhook_secret,
      bot_name, custom_system_prompt, ai_model, temperature, ai_provider_id,
      enable_customer_profiling, whatsapp_phone_number_id, whatsapp_business_account_id, is_whatsapp_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      conn.id,
      conn.user_id,
      conn.page_id,
      conn.page_name,
      conn.access_token,
      conn.is_active ? 1 : 0,
      conn.webhook_secret,
      conn.bot_name,
      conn.custom_system_prompt,
      conn.ai_model,
      conn.temperature,
      conn.ai_provider_id ?? null,
      conn.enable_customer_profiling ? 1 : 0,
      conn.whatsapp_phone_number_id ?? null,
      conn.whatsapp_business_account_id ?? null,
      conn.is_whatsapp_active ? 1 : 0
    )
    .run();
}

export async function getPageConnectionFallback(
  db: D1Database,
  supabase: SupabaseClient,
  pageId: string
): Promise<PageConnection | null> {
  await ensureD1Initialized(db);
  try {
    const { data, error } = await supabase
      .from('page_connections')
      .select('*')
      .or(`page_id.eq.${pageId},instagram_account_id.eq.${pageId},whatsapp_phone_number_id.eq.${pageId}`)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      const conn = data as PageConnection;
      if (conn.instagram_account_id === pageId) {
        if (!conn.is_instagram_active) return null;
      } else if (conn.whatsapp_phone_number_id === pageId) {
        if (!conn.is_whatsapp_active) return null;
      } else {
        if (!conn.is_active) return null;
      }
      await cachePageConnection(db, conn);
      return conn;
    }
  } catch (err: any) {
    console.warn(`[Failover] Supabase page connection query failed: ${err.message}. Trying D1 fallback.`);
  }

  // Fallback to D1
  const row = await db.prepare(
    `SELECT * FROM page_connections WHERE page_id = ? OR instagram_account_id = ? OR whatsapp_phone_number_id = ?`
  )
    .bind(pageId, pageId, pageId)
    .first();

  if (row) {
    const conn = mapConnectionRow(row);
    if (conn.instagram_account_id === pageId) {
      if (!conn.is_instagram_active) return null;
    } else if (conn.whatsapp_phone_number_id === pageId) {
      if (!conn.is_whatsapp_active) return null;
    } else {
      if (!conn.is_active) return null;
    }
    return conn;
  }
  return null;
}

export async function getWhatsAppConnectionFallback(
  db: D1Database,
  supabase: SupabaseClient,
  phoneNumberId: string
): Promise<PageConnection | null> {
  await ensureD1Initialized(db);
  try {
    const { data, error } = await supabase
      .from('page_connections')
      .select('*')
      .eq('whatsapp_phone_number_id', phoneNumberId)
      .eq('is_whatsapp_active', true)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      const conn = data as PageConnection;
      await cachePageConnection(db, conn);
      return conn;
    }
  } catch (err: any) {
    console.warn(`[Failover] Supabase WhatsApp connection query failed: ${err.message}. Trying D1 fallback.`);
  }

  // Fallback to D1
  const row = await db.prepare(
    `SELECT * FROM page_connections WHERE whatsapp_phone_number_id = ? AND is_whatsapp_active = 1`
  )
    .bind(phoneNumberId)
    .first();

  return row ? mapConnectionRow(row) : null;
}

// ─── AI Providers Failover ───────────────────────────────────────────────────

export async function getAIProvidersFallback(
  db: D1Database,
  supabase: SupabaseClient,
  userId: string
): Promise<any[]> {
  await ensureD1Initialized(db);
  try {
    const { data, error } = await supabase
      .from('ai_providers')
      .select('*')
      .or(`user_id.eq.${userId},is_global.eq.true`);

    if (error) throw error;
    if (data) {
      // Replicate on read
      for (const p of data) {
        await db.prepare(
          `INSERT OR REPLACE INTO ai_providers (
            id, user_id, provider_name, display_name, base_url, api_key, model_chat, model_embedding,
            is_active_chat, is_active_embedding, is_active_summarization, is_active_agent, is_active_vision, is_global,
            fallback_chat_order, fallback_agent_order, fallback_summarize_order, fallback_vision_order, fallback_embedding_order,
            extra_headers, max_tokens, temperature, context_window
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            p.id,
            p.user_id,
            p.provider_name,
            p.display_name,
            p.base_url,
            p.api_key,
            p.model_chat,
            p.model_embedding,
            p.is_active_chat ? 1 : 0,
            p.is_active_embedding ? 1 : 0,
            p.is_active_summarization ? 1 : 0,
            p.is_active_agent ? 1 : 0,
            p.is_active_vision ? 1 : 0,
            p.is_global ? 1 : 0,
            p.fallback_chat_order ?? null,
            p.fallback_agent_order ?? null,
            p.fallback_summarize_order ?? null,
            p.fallback_vision_order ?? null,
            p.fallback_embedding_order ?? null,
            JSON.stringify(p.extra_headers),
            p.max_tokens ?? null,
            p.temperature ?? null,
            p.context_window ?? null
          )
          .run();
      }
      return data;
    }
  } catch (err: any) {
    console.warn(`[Failover] Supabase AI providers query failed: ${err.message}. Trying D1 fallback.`);
  }

  // Fallback to D1
  const { results } = await db.prepare(
    `SELECT * FROM ai_providers WHERE user_id = ? OR is_global = 1`
  )
    .bind(userId)
    .all();

  return results.map(r => ({
    id: r.id,
    user_id: r.user_id,
    provider_name: r.provider_name,
    display_name: r.display_name,
    base_url: r.base_url,
    api_key: r.api_key,
    model_chat: r.model_chat,
    model_embedding: r.model_embedding,
    is_active_chat: r.is_active_chat === 1,
    is_active_embedding: r.is_active_embedding === 1,
    is_active_summarization: r.is_active_summarization === 1,
    is_active_agent: r.is_active_agent === 1,
    is_active_vision: r.is_active_vision === 1,
    is_global: r.is_global === 1,
    fallback_chat_order: r.fallback_chat_order,
    fallback_agent_order: r.fallback_agent_order,
    fallback_summarize_order: r.fallback_summarize_order,
    fallback_vision_order: r.fallback_vision_order,
    fallback_embedding_order: r.fallback_embedding_order,
    extra_headers: safeJsonParse(r.extra_headers) || {},
    max_tokens: r.max_tokens,
    temperature: r.temperature,
    context_window: r.context_window,
  }));
}

// ─── Knowledge Fields Failover ───────────────────────────────────────────────

export async function getKnowledgeFieldsFallback(
  db: D1Database,
  supabase: SupabaseClient,
  userId: string,
  pageId: string
): Promise<any[]> {
  await ensureD1Initialized(db);
  try {
    const { data, error } = await supabase
      .from('knowledge_fields')
      .select('id, field_name, field_value, category, value_type, display_label, description, page_id, sort_order, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .or(`page_id.eq.${pageId},page_id.is.null`)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    if (data) {
      // Cache in D1
      for (const f of data) {
        await db.prepare(
          `INSERT OR REPLACE INTO knowledge_fields (
            id, user_id, field_name, field_value, category, value_type, display_label, description, page_id, sort_order, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            f.id || `${userId}_${f.field_name}_${f.page_id || 'global'}`,
            userId,
            f.field_name,
            f.field_value,
            f.category,
            f.value_type ?? 'string',
            f.display_label ?? null,
            f.description ?? null,
            f.page_id ?? null,
            f.sort_order ?? 0,
            f.is_active ? 1 : 0
          )
          .run();
      }
      return data;
    }
  } catch (err: any) {
    console.warn(`[Failover] Supabase knowledge fields query failed: ${err.message}. Trying D1 fallback.`);
  }

  // Fallback to D1
  const { results } = await db.prepare(
    `SELECT field_name, field_value, category, value_type, display_label, description, page_id FROM knowledge_fields
     WHERE user_id = ? AND is_active = 1 AND (page_id = ? OR page_id IS NULL)
     ORDER BY sort_order ASC`
  )
    .bind(userId, pageId)
    .all();

  return results;
}

// ─── Customer Profiles Failover ──────────────────────────────────────────────

export async function getCustomerProfileFallback(
  db: D1Database,
  supabase: SupabaseClient,
  pageId: string,
  senderId: string
): Promise<any | null> {
  await ensureD1Initialized(db);
  try {
    const { data, error } = await supabase
      .from('customer_profiles')
      .select('summary')
      .eq('page_id', pageId)
      .eq('sender_id', senderId)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      await db.prepare(
        `INSERT OR REPLACE INTO customer_profiles (id, page_id, sender_id, summary) VALUES (?, ?, ?, ?)`
      )
        .bind(`${pageId}_${senderId}`, pageId, senderId, data.summary)
        .run();
      return data;
    }
  } catch (err: any) {
    console.warn(`[Failover] Supabase customer profile query failed: ${err.message}. Trying D1 fallback.`);
  }

  // Fallback to D1
  const row = await db.prepare(
    `SELECT summary FROM customer_profiles WHERE page_id = ? AND sender_id = ?`
  )
    .bind(pageId, senderId)
    .first();

  return row ? { summary: row.summary } : null;
}

// ─── Message Count Fallback ──────────────────────────────────────────────────

export async function getMonthlyMessageCountFallback(
  db: D1Database,
  supabase: SupabaseClient,
  userId: string,
  startDateStr: string
): Promise<number> {
  await ensureD1Initialized(db);
  try {
    const { count, error } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startDateStr);

    if (error) throw error;
    return count ?? 0;
  } catch (err: any) {
    console.warn(`[Failover] Supabase messages count failed: ${err.message}. Counting local D1 rows.`);
  }

  // Fallback D1
  const row = await db.prepare(
    `SELECT COUNT(*) as cnt FROM chat_messages WHERE user_id = ? AND created_at >= ?`
  )
    .bind(userId, startDateStr)
    .first();

  return (row?.cnt as number) ?? 0;
}

// ─── Session Context Fallback ────────────────────────────────────────────────

export async function getSessionContextFallback(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  limit: number
): Promise<any[]> {
  await ensureD1Initialized(db);
  try {
    const { data, error } = await supabase.rpc('get_session_context', {
      p_session_id: sessionId,
      p_limit: limit,
    });

    if (error) throw error;
    if (data && data.length > 0) {
      // Replicate on read
      for (const m of data) {
        await db.prepare(
          `INSERT OR REPLACE INTO chat_messages (id, session_id, user_id, role, content, fb_message_id, created_at, token_count, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            m.id,
            sessionId,
            m.user_id,
            m.role,
            m.content,
            m.fb_message_id,
            m.created_at,
            m.token_count ?? null,
            JSON.stringify(m.metadata)
          )
          .run();
      }
      return data;
    }
  } catch (err: any) {
    console.warn(`[Failover] Supabase get_session_context RPC failed: ${err.message}. Trying D1 fallback.`);
  }

  // Fallback D1
  const { results } = await db.prepare(
    `SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?`
  )
    .bind(sessionId, limit)
    .all();

  return results.map(r => ({
    id: r.id,
    role: r.role,
    content: r.content,
    fb_message_id: r.fb_message_id,
    created_at: r.created_at,
    token_count: r.token_count,
    metadata: safeJsonParse(r.metadata),
    user_id: r.user_id
  }));
}

// ─── Session State Fallbacks ─────────────────────────────────────────────────

export async function getChatSessionFallback(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string
): Promise<any | null> {
  await ensureD1Initialized(db);
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('bot_paused, sender_name, unread_count')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      await db.prepare(
        `INSERT OR REPLACE INTO chat_sessions (id, bot_paused, sender_name, unread_count)
         VALUES (?, ?, ?, ?)`
      )
        .bind(sessionId, data.bot_paused ? 1 : 0, data.sender_name ?? null, data.unread_count ?? 0)
        .run();
      return data;
    }
  } catch (err: any) {
    console.warn(`[Failover] Supabase session get failed: ${err.message}. Trying D1 fallback.`);
  }

  const row = await db.prepare(`SELECT bot_paused, sender_name, unread_count FROM chat_sessions WHERE id = ?`).bind(sessionId).first();
  if (!row) return null;

  return {
    bot_paused: row.bot_paused === 1,
    sender_name: row.sender_name,
    unread_count: row.unread_count
  };
}

export async function getLatestMessageRoleFallback(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string
): Promise<string | null> {
  await ensureD1Initialized(db);
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('role')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.role ?? null;
  } catch (err: any) {
    console.warn(`[Failover] Supabase latest message role failed: ${err.message}. Trying D1 fallback.`);
  }

  const row = await db.prepare(
    `SELECT role FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`
  )
    .bind(sessionId)
    .first();

  return (row?.role as string) ?? null;
}

export async function updateSessionSenderNameFallback(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  senderName: string
): Promise<void> {
  await ensureD1Initialized(db);
  try {
    await supabase
      .from('chat_sessions')
      .update({ sender_name: senderName })
      .eq('id', sessionId)
      .is('sender_name', null);
  } catch (err: any) {
    console.warn(`[Failover] Supabase sender name update failed: ${err.message}. Updating D1 only.`);
  }

  await db.prepare(`UPDATE chat_sessions SET sender_name = ? WHERE id = ? AND sender_name IS NULL`)
    .bind(senderName, sessionId)
    .run();
}

// ─── Lock Helpers ────────────────────────────────────────────────────────────

export async function acquireSessionLockFallback(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  durationSeconds: number = 30
): Promise<boolean> {
  await ensureD1Initialized(db);
  try {
    const { data, error } = await supabase.rpc('acquire_session_lock', {
      p_session_id: sessionId,
      p_lock_duration: durationSeconds,
    });
    if (error) throw error;
    return data === true;
  } catch (err: any) {
    console.warn(`[Failover] Supabase session lock RPC failed: ${err.message}. Bypassing lock under outage.`);
    // In local D1 we bypass locking during outages to make sure chatbot stays responsive,
    // since Cloudflare handles worker isolation and retry logic well.
    return true;
  }
}

export async function releaseSessionLockFallback(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc('release_session_lock', {
      p_session_id: sessionId,
    });
    if (error) throw error;
  } catch (err: any) {
    console.warn(`[Failover] Supabase release lock failed: ${err.message}. Ignoring.`);
  }
}

// ─── Save Messages & Sessions ────────────────────────────────────────────────

export async function storeIncomingMessageFallback(
  db: D1Database,
  supabase: SupabaseClient,
  userId: string,
  pageId: string,
  senderId: string,
  messageText: string,
  fbMessageId: string,
  accessToken?: string
): Promise<{ sessionId: string, botPaused: boolean } | null> {
  await ensureD1Initialized(db);

  let supabaseResult: { sessionId: string; botPaused: boolean } | null = null;
  let supabaseErr: any = null;

  // 1. Try Supabase
  try {
    const { data: sessionData, error: sessionError } = await supabase.rpc(
      'get_or_create_session',
      {
        p_page_id: pageId,
        p_sender_id: senderId,
        p_user_id: userId,
        p_session_timeout: 1800,
      }
    );

    if (sessionError) throw sessionError;
    if (sessionData?.o_session_id) {
      const sessionId = sessionData.o_session_id;
      const botPaused = sessionData.o_bot_paused;

      const { data: existing } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('fb_message_id', fbMessageId)
        .maybeSingle();

      if (existing) {
        console.log(`[Failover] Duplicate fb_message_id ${fbMessageId} on Supabase, skipping`);
        return null;
      }

      const { error: insertError } = await supabase.from('chat_messages').insert({
        session_id: sessionId,
        user_id: userId,
        role: 'user',
        content: messageText,
        fb_message_id: fbMessageId,
      });

      if (insertError) {
        if ((insertError as any).code === '23505') {
          console.log(`[Failover] Duplicate message constraint on Supabase, skipping`);
          return null;
        }
        throw insertError;
      }

      // Fetch profile if needed
      let updatePayload: any = {
        last_message_at: new Date().toISOString(),
      };

      supabaseResult = { sessionId, botPaused };
    }
  } catch (err: any) {
    supabaseErr = err;
    console.warn(`[Failover] Supabase storeIncomingMessage failed: ${err.message}. Processing locally via D1.`);
  }

  // 2. Local D1 Flow (Runs if Supabase failed, or caches on success)
  const now = new Date().toISOString();
  let finalSessionId: string;
  let botPaused = false;

  if (supabaseResult) {
    finalSessionId = supabaseResult.sessionId;
    botPaused = supabaseResult.botPaused;
  } else {
    // Determine or create session in D1
    const localSession = await db.prepare(
      `SELECT id, bot_paused FROM chat_sessions WHERE page_id = ? AND sender_id = ?`
    )
      .bind(pageId, senderId)
      .first();

    if (localSession) {
      finalSessionId = localSession.id as string;
      botPaused = localSession.bot_paused === 1;
    } else {
      finalSessionId = crypto.randomUUID();
      await db.prepare(
        `INSERT INTO chat_sessions (id, user_id, page_id, sender_id, bot_paused, unread_count, last_message_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(finalSessionId, userId, pageId, senderId, 0, 0, now)
        .run();
    }
  }

  // Save/Cache message to D1
  const existingLocalMsg = await db.prepare(
    `SELECT id FROM chat_messages WHERE fb_message_id = ?`
  )
    .bind(fbMessageId)
    .first();

  if (existingLocalMsg) {
    console.log(`[Failover] Local duplicate fb_message_id ${fbMessageId}, skipping`);
    return null;
  }

  const messageId = crypto.randomUUID();
  const syncedFlag = supabaseResult ? 1 : 0; // 0 means unsynced, will be synced by background cron

  await db.prepare(
    `INSERT INTO chat_messages (id, session_id, user_id, role, content, fb_message_id, created_at, synced_to_supabase)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(messageId, finalSessionId, userId, 'user', messageText, fbMessageId, now, syncedFlag)
    .run();

  // Cache or update session metadata in D1
  await db.prepare(
    `UPDATE chat_sessions SET last_message_at = ?, bot_paused = ? WHERE id = ?`
  )
    .bind(now, botPaused ? 1 : 0, finalSessionId)
    .run();

  return { sessionId: finalSessionId, botPaused };
}

export async function storeAssistantMessageFallback(
  db: D1Database,
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  reply: string,
  tokenCount: number | null,
  metadata: any
): Promise<void> {
  await ensureD1Initialized(db);
  const now = new Date().toISOString();
  const messageId = crypto.randomUUID();

  let supabaseSuccess = false;
  try {
    const { error } = await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: userId,
      role: 'assistant',
      content: reply,
      token_count: tokenCount,
      metadata,
    });
    if (error) throw error;
    supabaseSuccess = true;
  } catch (err: any) {
    console.warn(`[Failover] Supabase storeAssistantMessage failed: ${err.message}. Saving locally to D1.`);
  }

  // Save to D1
  await db.prepare(
    `INSERT INTO chat_messages (id, session_id, user_id, role, content, fb_message_id, created_at, token_count, metadata, synced_to_supabase)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      messageId,
      sessionId,
      userId,
      'assistant',
      reply,
      `assistant_${messageId}`,
      now,
      tokenCount,
      JSON.stringify(metadata),
      supabaseSuccess ? 1 : 0
    )
    .run();
}

// ─── Background Sync Offline Messages ───────────────────────────────────────

export async function syncOfflineMessages(
  db: D1Database,
  supabase: SupabaseClient
): Promise<number> {
  await ensureD1Initialized(db);

  // Get unsynced messages ordered chronologically
  const { results } = await db.prepare(
    `SELECT * FROM chat_messages WHERE synced_to_supabase = 0 ORDER BY created_at ASC`
  )
    .all();

  if (!results || results.length === 0) return 0;

  console.log(`[Sync] Found ${results.length} offline messages to sync to Supabase...`);
  let syncedCount = 0;

  for (const msg of results) {
    try {
      // 1. Resolve session in Supabase (create if it doesn't exist)
      // Since it's failover, the session might not exist in Supabase yet.
      // We query D1 to get the user_id, page_id, and sender_id for this session.
      const localSession = await db.prepare(
        `SELECT user_id, page_id, sender_id FROM chat_sessions WHERE id = ?`
      )
        .bind(msg.session_id)
        .first();

      if (!localSession) {
        console.warn(`[Sync] Session info not found locally for message ${msg.id}. Skipping.`);
        continue;
      }

      const { data: sessionData, error: sessionErr } = await supabase.rpc(
        'get_or_create_session',
        {
          p_page_id: localSession.page_id,
          p_sender_id: localSession.sender_id,
          p_user_id: localSession.user_id,
          p_session_timeout: 1800,
        }
      );

      if (sessionErr) throw sessionErr;

      const targetSessionId = sessionData.o_session_id;

      // 2. Check if the message is already in Supabase (avoid duplicate constraint error)
      const { data: existing } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('fb_message_id', msg.fb_message_id)
        .maybeSingle();

      if (!existing) {
        const { error: insertErr } = await supabase.from('chat_messages').insert({
          session_id: targetSessionId,
          user_id: msg.user_id,
          role: msg.role,
          content: msg.content,
          fb_message_id: msg.fb_message_id,
          created_at: msg.created_at,
          token_count: msg.token_count,
          metadata: safeJsonParse(msg.metadata),
        });

        if (insertErr) throw insertErr;
      }

      // 3. Mark as synced in D1
      await db.prepare(`UPDATE chat_messages SET synced_to_supabase = 1 WHERE id = ?`)
        .bind(msg.id)
        .run();

      syncedCount++;
    } catch (err: any) {
      console.error(`[Sync] Failed to sync message ${msg.id}: ${err.message}. Aborting loop.`);
      break; // Stop syncing if connection is still down
    }
  }

  if (syncedCount > 0) {
    console.log(`[Sync] Successfully synchronized ${syncedCount} messages to Supabase.`);
  }
  return syncedCount;
}

export async function updateMessageMetadataFallback(
  db: D1Database,
  supabase: SupabaseClient,
  fbMessageId: string,
  metadata: any
): Promise<void> {
  await ensureD1Initialized(db);
  try {
    const { error } = await supabase
      .from('chat_messages')
      .update({ metadata })
      .eq('fb_message_id', fbMessageId);
    if (error) throw error;
  } catch (err: any) {
    console.warn(`[Failover] Supabase metadata update failed: ${err.message}. Updating D1 only.`);
  }

  await db.prepare(`UPDATE chat_messages SET metadata = ? WHERE fb_message_id = ?`)
    .bind(JSON.stringify(metadata), fbMessageId)
    .run();
}

