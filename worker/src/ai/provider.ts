// ============================================================================
// AI Provider Loader
// ============================================================================
// Loads the active AI provider configurations from Supabase for a given tenant.
// Converts the DB rows into normalized AIProviderConfig objects and builds
// failover chains for each AI role.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AIProviderConfig } from './types';
import { getAIProvidersFallback, getUserRecord } from '../db';

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
  model_reasoning?: string | null;
  model_embedding: string | null;
  is_active_chat: boolean;
  is_active_embedding: boolean;
  is_active_summarization?: boolean;
  is_active_agent?: boolean;
  is_active_vision?: boolean;
  is_global?: boolean;
  fallback_order?: number;
  fallback_chat_order?: number | null;
  fallback_agent_order?: number | null;
  fallback_summarize_order?: number | null;
  fallback_vision_order?: number | null;
  fallback_embedding_order?: number | null;
  extra_headers: Record<string, string>;
  max_tokens: number | null;
  temperature: number | null;
  context_window: number | null;
}

/**
 * Unified provider chain resolver for any given role.
 * Resolves priority: user-assigned primary -> user active -> global active -> ordered fallbacks.
 */
async function getProviderChainForRole(
  supabase: SupabaseClient,
  userId: string,
  role: 'chat' | 'agent' | 'summarization' | 'embedding' | 'vision',
  db?: D1Database
): Promise<AIProviderConfig[]> {
  const activeField = role === 'summarization' ? 'is_active_summarization' : `is_active_${role}`;
  const configOrderField = `fallback${
    role === 'summarization'
      ? 'Summarize'
      : role.charAt(0).toUpperCase() + role.slice(1)
  }Order`;

  // Fetch all providers for the user (including global ones)
  let rows: any[];
  if (db) {
    rows = await getAIProvidersFallback(db, supabase, userId);
  } else {
    const { data, error } = await supabase
      .from('ai_providers')
      .select('*')
      .or(`user_id.eq.${userId},is_global.eq.true`);

    if (error || !data) {
      console.error(`[AI] Failed to load provider chain for ${role}:`, error?.message);
      return [];
    }
    rows = data;
  }

  // Convert to config format
  const configs = (rows as AIProviderRow[]).map(rowToConfig);

  // 1. Identify the Primary provider
  let primaryId: string | null = null;
  
  // Resolve assigned provider from users table
  const userAssignedFields: Record<string, string> = {
    chat: 'assigned_chat_provider_id',
    agent: 'assigned_agent_provider_id',
    summarization: 'assigned_summarization_provider_id',
    embedding: 'assigned_embedding_provider_id',
    vision: 'assigned_vision_provider_id'
  };

  const assignedCol = userAssignedFields[role];
  if (assignedCol) {
    let userRecord = null;
    if (db) {
      userRecord = await getUserRecord(db, supabase, userId);
    } else {
      const { data } = await supabase
        .from('users')
        .select(assignedCol)
        .eq('id', userId)
        .maybeSingle();
      userRecord = data;
    }
    
    if (userRecord && (userRecord as any)[assignedCol]) {
      primaryId = (userRecord as any)[assignedCol];
    }
  }

  let primary: AIProviderConfig | null = null;
  if (primaryId) {
    primary = configs.find(c => c.id === primaryId) || null;
  }

  // If no admin-assigned provider, look for tenant active provider
  if (!primary) {
    primary = configs.find(c => c.userId === userId && (c as any)[activeField] === true) || null;
  }

  // If still no tenant active provider, look for global active provider
  if (!primary) {
    primary = configs.find(c => c.userId === 'global' && (c as any)[activeField] === true) || null;
  }

  // 2. Identify Fallback providers
  // Filter for providers that have fallbackOrder > 0 for this role and are not primary
  const fallbacks = configs.filter(c => {
    const order = (c as any)[configOrderField];
    return order !== null && order > 0 && c.id !== primary?.id;
  });

  // Sort fallbacks by fallback order ascending, preferring user-specific over global if order is same
  fallbacks.sort((a, b) => {
    const orderA = (a as any)[configOrderField] || 999;
    const orderB = (b as any)[configOrderField] || 999;
    if (orderA !== orderB) return orderA - orderB;
    if (a.userId !== 'global' && b.userId === 'global') return -1;
    if (a.userId === 'global' && b.userId !== 'global') return 1;
    return 0;
  });

  const chain: AIProviderConfig[] = [];
  if (primary) {
    chain.push(primary);
  }
  chain.push(...fallbacks);

  return chain;
}

/**
 * Load the active chat completion provider chain.
 */
/**
 * Load the active chat completion provider chain.
 */
export async function getChatProviderChain(
  supabase: SupabaseClient,
  userId: string,
  db?: D1Database
): Promise<AIProviderConfig[]> {
  return getProviderChainForRole(supabase, userId, 'chat', db);
}

/**
 * Load the active chat completion provider for a tenant.
 */
export async function getActiveChatProvider(
  supabase: SupabaseClient,
  userId: string,
  db?: D1Database
): Promise<AIProviderConfig | null> {
  const chain = await getChatProviderChain(supabase, userId, db);
  return chain[0] || null;
}

/**
 * Load the agent provider chain.
 */
export async function getAgentProviderChain(
  supabase: SupabaseClient,
  userId: string,
  db?: D1Database
): Promise<AIProviderConfig[]> {
  return getProviderChainForRole(supabase, userId, 'agent', db);
}

/**
 * Load the active agent provider.
 */
export async function getActiveAgentProvider(
  supabase: SupabaseClient,
  userId: string,
  db?: D1Database
): Promise<AIProviderConfig | null> {
  const chain = await getAgentProviderChain(supabase, userId, db);
  return chain[0] || null;
}

/**
 * Load the embedding provider chain.
 */
export async function getEmbeddingProviderChain(
  supabase: SupabaseClient,
  userId: string,
  db?: D1Database
): Promise<AIProviderConfig[]> {
  const chain = await getProviderChainForRole(supabase, userId, 'embedding', db);
  
  // Fallback to chat provider chain if no dedicated embedding provider is configured
  if (chain.length === 0) {
    const chatChain = await getChatProviderChain(supabase, userId, db);
    return chatChain.filter(c => c.modelEmbedding && c.modelEmbedding.trim().length > 0);
  }
  return chain;
}

/**
 * Load the active embedding provider.
 */
export async function getActiveEmbeddingProvider(
  supabase: SupabaseClient,
  userId: string,
  db?: D1Database
): Promise<AIProviderConfig | null> {
  const chain = await getEmbeddingProviderChain(supabase, userId, db);
  return chain[0] || null;
}

/**
 * Load the summarization provider chain.
 */
export async function getSummarizationProviderChain(
  supabase: SupabaseClient,
  userId: string,
  db?: D1Database
): Promise<AIProviderConfig[]> {
  const chain = await getProviderChainForRole(supabase, userId, 'summarization', db);
  
  // Fallback to chat provider chain if no summarization provider is configured
  if (chain.length === 0) {
    return getChatProviderChain(supabase, userId, db);
  }
  return chain;
}

/**
 * Load the vision provider chain.
 */
export async function getVisionProviderChain(
  supabase: SupabaseClient,
  userId: string,
  db?: D1Database
): Promise<AIProviderConfig[]> {
  // Check if vision is allowed
  let allowVision = false;
  if (db) {
    const userRecord = await getUserRecord(db, supabase, userId);
    allowVision = userRecord?.allow_vision === 1 || userRecord?.allow_vision === true;
  } else {
    try {
      const { data: userRecord } = await supabase
        .from('users')
        .select('allow_vision')
        .eq('id', userId)
        .maybeSingle();
      allowVision = userRecord?.allow_vision || false;
    } catch (_) {}
  }

  if (!allowVision) {
    console.warn(`[AI] ⚠️ Vision is disabled for user ${userId}. Returning empty chain.`);
    return [];
  }

  return getProviderChainForRole(supabase, userId, 'vision', db);
}

/**
 * Load the active vision provider for processing images.
 */
export async function getActiveVisionProvider(
  supabase: SupabaseClient,
  userId: string,
  db?: D1Database
): Promise<AIProviderConfig | null> {
  const chain = await getVisionProviderChain(supabase, userId, db);
  return chain[0] || null;
}

/**
 * Kept for backward compatibility with components calling getAllChatProviders.
 */
export async function getAllChatProviders(
  supabase: SupabaseClient,
  userId: string,
  db?: D1Database
): Promise<AIProviderConfig[]> {
  return getChatProviderChain(supabase, userId, db);
}

/**
 * List all AI providers for a tenant.
 */
export async function listProviders(
  supabase: SupabaseClient,
  userId: string,
  db?: D1Database
): Promise<AIProviderConfig[]> {
  if (db) {
    const providers = await getAIProvidersFallback(db, supabase, userId);
    return providers.filter(p => p.userId === userId);
  }

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
  id: string,
  db?: D1Database
): Promise<AIProviderConfig | null> {
  let data;
  try {
    const { data: dbData, error } = await supabase
      .from('ai_providers')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!error && dbData) {
      data = dbData;
    }
  } catch (_) {}

  if (!data && db) {
    const row = await db.prepare(`SELECT * FROM ai_providers WHERE id = ?`).bind(id).first();
    if (row) {
      data = {
        ...row,
        is_active_chat: row.is_active_chat === 1,
        is_active_embedding: row.is_active_embedding === 1,
        is_active_summarization: row.is_active_summarization === 1,
        is_active_agent: row.is_active_agent === 1,
        is_active_vision: row.is_active_vision === 1,
        is_global: row.is_global === 1,
        extra_headers: typeof row.extra_headers === 'string' ? JSON.parse(row.extra_headers) : row.extra_headers
      };
    }
  }

  if (!data) {
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
    modelReasoning: row.model_reasoning ?? undefined,
    modelEmbedding: row.model_embedding ?? '',
    maxTokens: row.max_tokens ?? 1024,
    temperature: row.temperature ?? 0.7,
    contextWindow: row.context_window ?? 10,
    extraHeaders: row.extra_headers ?? {},
    fallbackChatOrder: row.fallback_chat_order ?? null,
    fallbackAgentOrder: row.fallback_agent_order ?? null,
    fallbackSummarizeOrder: row.fallback_summarize_order ?? null,
    fallbackVisionOrder: row.fallback_vision_order ?? null,
    fallbackEmbeddingOrder: row.fallback_embedding_order ?? null,
    is_active_chat: row.is_active_chat === true || (row.is_active_chat as any) === 1,
    is_active_embedding: row.is_active_embedding === true || (row.is_active_embedding as any) === 1,
    is_active_summarization: row.is_active_summarization === true || (row.is_active_summarization as any) === 1,
    is_active_agent: row.is_active_agent === true || (row.is_active_agent as any) === 1,
    is_active_vision: row.is_active_vision === true || (row.is_active_vision as any) === 1,
  };
}
