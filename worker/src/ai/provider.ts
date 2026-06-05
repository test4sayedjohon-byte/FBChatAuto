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
  is_global?: boolean;
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
 * Used for fallback mechanisms if the primary provider fails.
 */
export async function getAllChatProviders(
  supabase: SupabaseClient,
  userId: string
): Promise<AIProviderConfig[]> {
  const providers: AIProviderConfig[] = [];
  const addProvider = (row: AIProviderRow) => {
    if (!providers.find(p => p.baseUrl === row.base_url)) {
      providers.push(rowToConfig(row));
    }
  };

  // 1. Tenant's active provider
  const { data: tenantActive } = await supabase.from('ai_providers').select('*').eq('user_id', userId).eq('is_active_chat', true).maybeSingle();
  if (tenantActive) addProvider(tenantActive as AIProviderRow);

  // 2. Tenant's other providers
  const { data: tenantOthers } = await supabase.from('ai_providers').select('*').eq('user_id', userId).eq('is_active_chat', false);
  if (tenantOthers) tenantOthers.forEach(row => addProvider(row as AIProviderRow));

  // 3. Global active provider
  const { data: globalActive } = await supabase.from('ai_providers').select('*').eq('is_global', true).eq('is_active_chat', true).maybeSingle();
  if (globalActive) addProvider(globalActive as AIProviderRow);

  // 4. Global other providers
  const { data: globalOthers } = await supabase.from('ai_providers').select('*').eq('is_global', true).eq('is_active_chat', false);
  if (globalOthers) globalOthers.forEach(row => addProvider(row as AIProviderRow));

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
