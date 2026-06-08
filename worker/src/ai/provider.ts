// ============================================================================
// AI Provider Loader
// ============================================================================
// Loads the active AI provider configuration from Supabase for a given tenant.
// Converts the DB row into a normalized AIProviderConfig for the AI client.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AIProviderConfig } from './types';

/**
 * Database row shape for the ai_providers table.
 */
interface AIProviderRow {
  id: string;
  user_id: string | null;
  provider_name: string;
  display_name: string;
  base_url: string;
  api_key: string;
  model_chat: string | null;
  model_embedding: string | null;
  is_active_chat: boolean;
  is_active_embedding: boolean;
  is_active_summarization?: boolean;
  is_active_agent?: boolean;
  is_active_vision?: boolean;
  is_global?: boolean;
  fallback_order?: number;
  extra_headers: Record<string, string>;
  max_tokens: number | null;
  temperature: number | null;
  context_window: number | null;
}

/**
 * Load the active chat completion provider for a tenant.
 * Returns null if no active provider is configured.
 */
export async function getActiveChatProvider(
  supabase: SupabaseClient,
  userId: string
): Promise<AIProviderConfig | null> {
  // First, check if the tenant has a specific active chat provider assigned directly in their own providers
  const { data: tenantData } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active_chat', true)
    .maybeSingle();

  if (tenantData) {
    return rowToConfig(tenantData as AIProviderRow);
  }

  // Second, check if the super admin explicitly assigned a global provider to this user
  const { data: userRecord, error: uErr } = await supabase
    .from('users')
    .select('assigned_chat_provider_id')
    .eq('id', userId)
    .maybeSingle();

  console.log(`[AI] userRecord for ${userId}:`, userRecord, 'err:', uErr);

  if (userRecord?.assigned_chat_provider_id) {
    const { data: assignedProvider, error: pErr } = await supabase
      .from('ai_providers')
      .select('*')
      .eq('id', userRecord.assigned_chat_provider_id)
      .maybeSingle();
      
    console.log(`[AI] assignedProvider ${userRecord.assigned_chat_provider_id}:`, !!assignedProvider, 'err:', pErr);
      
    if (assignedProvider) {
      return rowToConfig(assignedProvider as AIProviderRow);
    }
  }

  // Fallback to the default global active chat provider
  const { data: globalData } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('is_global', true)
    .eq('is_active_chat', true)
    .maybeSingle();

  if (globalData) {
    return rowToConfig(globalData as AIProviderRow);
  }

  console.error(`[AI] No active chat provider (tenant, assigned, or global) for user ${userId}`);
  return null;
}

/**
 * Load all available chat completion providers for a tenant, ordered by priority.
 * Uses a single DB RPC that returns providers in priority order:
 *   assigned primary → assigned fallback → tenant active → tenant fallbacks →
 *   tenant others → global active → global fallbacks → global others
 */
export async function getAllChatProviders(
  supabase: SupabaseClient,
  userId: string
): Promise<AIProviderConfig[]> {
  const { data, error } = await supabase.rpc('get_all_chat_providers', {
    p_user_id: userId,
  });

  if (error) {
    console.error(`[AI] Failed to load chat providers for user ${userId}:`, error.message);
    return [];
  }

  if (!data || data.length === 0) {
    console.error(`[AI] No chat providers found for user ${userId}`);
    return [];
  }

  // Deduplicate by ID (RPC handles ordering, but CROSS JOIN may produce duplicates
  // when a provider matches multiple conditions)
  const seen = new Set<string>();
  const providers: AIProviderConfig[] = [];

  for (const row of data) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      providers.push(rowToConfig(row as AIProviderRow));
    }
  }

  return providers;
}

/**
 * Load the active embedding provider for a tenant.
 * Falls back to the chat provider if no dedicated embedding provider is set.
 */
export async function getActiveEmbeddingProvider(
  supabase: SupabaseClient,
  userId: string
): Promise<AIProviderConfig | null> {
  // First try dedicated embedding provider for the tenant
  const { data: tenantEmbedding } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active_embedding', true)
    .maybeSingle();

  if (tenantEmbedding) {
    return rowToConfig(tenantEmbedding as AIProviderRow);
  }

  // Second check if super admin assigned an embedding provider
  const { data: userRecord } = await supabase
    .from('users')
    .select('assigned_embedding_provider_id')
    .eq('id', userId)
    .maybeSingle();

  if (userRecord?.assigned_embedding_provider_id) {
    const { data: assignedProvider } = await supabase
      .from('ai_providers')
      .select('*')
      .eq('id', userRecord.assigned_embedding_provider_id)
      .maybeSingle();
      
    if (assignedProvider) {
      return rowToConfig(assignedProvider as AIProviderRow);
    }
  }

  // Third, Fallback to active chat provider for the tenant if it has an embedding model
  const { data: tenantChat } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active_chat', true)
    .maybeSingle();

  if (tenantChat && (tenantChat as AIProviderRow).model_embedding) {
    return rowToConfig(tenantChat as AIProviderRow);
  }

  // Fourth, Fallback to global dedicated embedding provider
  const { data: globalEmbedding } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('is_global', true)
    .eq('is_active_embedding', true)
    .maybeSingle();

  if (globalEmbedding) {
    return rowToConfig(globalEmbedding as AIProviderRow);
  }

  // Fifth, Fallback to global active chat provider if it has an embedding model
  const { data: globalChat } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('is_global', true)
    .eq('is_active_chat', true)
    .maybeSingle();

  if (globalChat && (globalChat as AIProviderRow).model_embedding) {
    return rowToConfig(globalChat as AIProviderRow);
  }

  console.error(`[AI] No embedding provider available (tenant, assigned, or global) for user ${userId}`);
  return null;
}

/**
 * Load the active agent provider.
 * Resolution: assigned per-user → global active agent → chat provider fallback.
 */
export async function getActiveAgentProvider(
  supabase: SupabaseClient,
  userId: string
): Promise<AIProviderConfig | null> {
  // 1. Check if super admin assigned a specific agent provider to this user
  const { data: userRecord } = await supabase
    .from('users')
    .select('assigned_agent_provider_id')
    .eq('id', userId)
    .maybeSingle();

  if (userRecord?.assigned_agent_provider_id) {
    const { data: assignedProvider } = await supabase
      .from('ai_providers')
      .select('*')
      .eq('id', userRecord.assigned_agent_provider_id)
      .maybeSingle();

    if (assignedProvider) {
      return rowToConfig(assignedProvider as AIProviderRow);
    }
  }

  // 2. Check global active agent provider
  const { data: globalAgent } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('is_global', true)
    .eq('is_active_agent', true)
    .maybeSingle();

  if (globalAgent) {
    return rowToConfig(globalAgent as AIProviderRow);
  }

  // 3. Fallback to the active chat provider if no specific agent provider is set
  return getActiveChatProvider(supabase, userId);
}

/**
 * Load the active vision provider for processing images.
 * Resolution: assigned per-user → tenant active vision → global active vision → null.
 *
 * IMPORTANT: This function returns null if no dedicated vision-capable provider is
 * configured. It does NOT fall back to the chat provider, because sending image
 * payloads to text-only models causes errors. The caller is responsible for
 * detecting null and sending a graceful canned reply.
 */
export async function getActiveVisionProvider(
  supabase: SupabaseClient,
  userId: string
): Promise<AIProviderConfig | null> {
  // 1. Check if vision is enabled for this user
  const { data: userRecord } = await supabase
    .from('users')
    .select('allow_vision, assigned_vision_provider_id')
    .eq('id', userId)
    .maybeSingle();

  if (!userRecord || !userRecord.allow_vision) {
    console.warn(`[AI] ⚠️ Vision is disabled for user ${userId}. Returning null (canned reply).`);
    return null;
  }

  if (userRecord?.assigned_vision_provider_id) {
    const { data: assignedProvider } = await supabase
      .from('ai_providers')
      .select('*')
      .eq('id', userRecord.assigned_vision_provider_id)
      .maybeSingle();

    if (assignedProvider) {
      console.log(`[AI] 👁️ Vision provider resolved via admin assignment: ${(assignedProvider as AIProviderRow).provider_name}`);
      return rowToConfig(assignedProvider as AIProviderRow);
    }
  }

  // 2. Check if the tenant has their own vision-enabled provider
  const { data: tenantVision } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active_vision', true)
    .maybeSingle();

  if (tenantVision) {
    console.log(`[AI] 👁️ Vision provider resolved via tenant config: ${(tenantVision as AIProviderRow).provider_name}`);
    return rowToConfig(tenantVision as AIProviderRow);
  }

  // 3. Check global active vision provider
  const { data: globalVision } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('is_global', true)
    .eq('is_active_vision', true)
    .maybeSingle();

  if (globalVision) {
    console.log(`[AI] 👁️ Vision provider resolved via global config: ${(globalVision as AIProviderRow).provider_name}`);
    return rowToConfig(globalVision as AIProviderRow);
  }

  // 4. No dedicated vision provider found — return null so the caller can handle gracefully
  console.warn(`[AI] ⚠️ No dedicated vision provider configured for user ${userId}. Image processing will be skipped.`);
  return null;
}

/**
 * List all AI providers for a tenant.
 */
export async function listProviders(
  supabase: SupabaseClient,
  userId: string
): Promise<AIProviderConfig[]> {
  const { data, error } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as AIProviderRow[]).map(rowToConfig);
}

/**
 * Load a specific provider by its ID.
 */
export async function getProviderById(
  supabase: SupabaseClient,
  id: string
): Promise<AIProviderConfig | null> {
  const { data, error } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return rowToConfig(data as AIProviderRow);
}

/**
 * Convert a database row to a normalized AIProviderConfig.
 */
function rowToConfig(row: AIProviderRow): AIProviderConfig {
  return {
    id: row.id,
    userId: row.user_id ?? 'global',
    providerName: row.provider_name,
    displayName: row.display_name,
    baseUrl: row.base_url.replace(/\/+$/, ''), // Strip trailing slashes
    apiKey: row.api_key,
    modelChat: row.model_chat ?? '',
    modelEmbedding: row.model_embedding ?? '',
    maxTokens: row.max_tokens ?? 1024,
    temperature: row.temperature ?? 0.7,
    contextWindow: row.context_window ?? 10,
    extraHeaders: row.extra_headers ?? {},
  };
}
