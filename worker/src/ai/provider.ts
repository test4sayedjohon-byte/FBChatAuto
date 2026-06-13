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
  is_active_image?: boolean;
  is_active_content?: boolean;
  is_global?: boolean;
  fallback_order?: number;
  fallback_chat_order?: number | null;
  fallback_agent_order?: number | null;
  fallback_summarize_order?: number | null;
  fallback_vision_order?: number | null;
  fallback_embedding_order?: number | null;
  fallback_image_order?: number | null;
  fallback_content_order?: number | null;
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
  role: 'chat' | 'agent' | 'summarization' | 'embedding' | 'vision' | 'comment_analysis' | 'image' | 'content',
  db?: D1Database
): Promise<AIProviderConfig[]> {
  const activeField = role === 'comment_analysis'
    ? 'is_active_chat'
    : (role === 'summarization' ? 'is_active_summarization' : `is_active_${role}`);

  const configOrderField = role === 'comment_analysis'
    ? 'fallbackChatOrder'
    : `fallback${
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
    vision: 'assigned_vision_provider_id',
    comment_analysis: 'assigned_comment_analysis_provider_id',
    image: 'assigned_image_provider_id',
    content: 'assigned_content_provider_id'
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
 * Helper to check if a feature key is disabled in user settings.
 */
function isFeatureDisabledByUser(userRecord: any, featureKey: string): boolean {
  if (!userRecord || !userRecord.settings) return false;
  let settings = userRecord.settings;
  if (typeof settings === 'string') {
    try {
      settings = JSON.parse(settings);
    } catch (_) {
      return false;
    }
  }
  if (settings && Array.isArray(settings.disabled_features)) {
    return settings.disabled_features.includes(featureKey);
  }
  return false;
}

/**
 * Load the active chat completion provider chain.
 */
export async function getChatProviderChain(
  supabase: SupabaseClient,
  userId: string,
  db?: D1Database
): Promise<AIProviderConfig[]> {
  // Check if chat is allowed (defaults to true)
  let allowChat = true;
  let userRecord: any = null;
  if (db) {
    userRecord = await getUserRecord(db, supabase, userId);
    if (userRecord && userRecord.allow_chat !== undefined && userRecord.allow_chat !== null) {
      allowChat = userRecord.allow_chat === 1 || userRecord.allow_chat === true;
    }
  } else {
    try {
      const { data: res } = await supabase
        .from('users')
        .select('allow_chat, settings')
        .eq('id', userId)
        .maybeSingle();
      userRecord = res;
      if (userRecord && userRecord.allow_chat !== null && userRecord.allow_chat !== undefined) {
        allowChat = userRecord.allow_chat;
      }
    } catch (_) {}
  }

  if (allowChat && userRecord && isFeatureDisabledByUser(userRecord, 'allow_chat')) {
    allowChat = false;
  }

  if (!allowChat) {
    console.warn(`[AI] ⚠️ Chat is disabled for user ${userId}. Returning empty chain.`);
    return [];
  }

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
  // Check if agent is allowed (defaults to true)
  let allowAgent = true;
  let userRecord: any = null;
  if (db) {
    userRecord = await getUserRecord(db, supabase, userId);
    if (userRecord && userRecord.allow_agent !== undefined && userRecord.allow_agent !== null) {
      allowAgent = userRecord.allow_agent === 1 || userRecord.allow_agent === true;
    }
  } else {
    try {
      const { data: res } = await supabase
        .from('users')
        .select('allow_agent, settings')
        .eq('id', userId)
        .maybeSingle();
      userRecord = res;
      if (userRecord && userRecord.allow_agent !== null && userRecord.allow_agent !== undefined) {
        allowAgent = userRecord.allow_agent;
      }
    } catch (_) {}
  }

  if (allowAgent && userRecord && isFeatureDisabledByUser(userRecord, 'allow_agent')) {
    allowAgent = false;
  }

  if (!allowAgent) {
    console.warn(`[AI] ⚠️ Agent is disabled for user ${userId}. Returning empty chain.`);
    return [];
  }

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
  // Check if embeddings are allowed (defaults to true)
  let allowEmbeddings = true;
  let userRecord: any = null;
  if (db) {
    userRecord = await getUserRecord(db, supabase, userId);
    if (userRecord && userRecord.allow_embeddings !== undefined && userRecord.allow_embeddings !== null) {
      allowEmbeddings = userRecord.allow_embeddings === 1 || userRecord.allow_embeddings === true;
    }
  } else {
    try {
      const { data: res } = await supabase
        .from('users')
        .select('allow_embeddings, settings')
        .eq('id', userId)
        .maybeSingle();
      userRecord = res;
      if (userRecord && userRecord.allow_embeddings !== null && userRecord.allow_embeddings !== undefined) {
        allowEmbeddings = userRecord.allow_embeddings;
      }
    } catch (_) {}
  }

  if (allowEmbeddings && userRecord && isFeatureDisabledByUser(userRecord, 'allow_embeddings')) {
    allowEmbeddings = false;
  }

  if (!allowEmbeddings) {
    console.warn(`[AI] ⚠️ Embeddings are disabled for user ${userId}. Returning empty chain.`);
    return [];
  }

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
  // Check if summarization is allowed (defaults to true)
  let allowSummarization = true;
  let userRecord: any = null;
  if (db) {
    userRecord = await getUserRecord(db, supabase, userId);
    if (userRecord && userRecord.allow_summarization !== undefined && userRecord.allow_summarization !== null) {
      allowSummarization = userRecord.allow_summarization === 1 || userRecord.allow_summarization === true;
    }
  } else {
    try {
      const { data: res } = await supabase
        .from('users')
        .select('allow_summarization, settings')
        .eq('id', userId)
        .maybeSingle();
      userRecord = res;
      if (userRecord && userRecord.allow_summarization !== null && userRecord.allow_summarization !== undefined) {
        allowSummarization = userRecord.allow_summarization;
      }
    } catch (_) {}
  }

  if (allowSummarization && userRecord && isFeatureDisabledByUser(userRecord, 'allow_summarization')) {
    allowSummarization = false;
  }

  if (!allowSummarization) {
    console.warn(`[AI] ⚠️ Summarization is disabled for user ${userId}. Returning empty chain.`);
    return [];
  }

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
  // Check if vision is allowed (defaults to true)
  let allowVision = true;
  let userRecord: any = null;
  if (db) {
    userRecord = await getUserRecord(db, supabase, userId);
    if (userRecord && userRecord.allow_vision !== undefined && userRecord.allow_vision !== null) {
      allowVision = userRecord.allow_vision === 1 || userRecord.allow_vision === true;
    }
  } else {
    try {
      const { data: res } = await supabase
        .from('users')
        .select('allow_vision, settings')
        .eq('id', userId)
        .maybeSingle();
      userRecord = res;
      if (userRecord && userRecord.allow_vision !== null && userRecord.allow_vision !== undefined) {
        allowVision = userRecord.allow_vision;
      }
    } catch (_) {}
  }

  if (allowVision && userRecord && isFeatureDisabledByUser(userRecord, 'allow_vision')) {
    allowVision = false;
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
 * Load the active comment analysis provider chain.
 */
export async function getCommentAnalysisProviderChain(
  supabase: SupabaseClient,
  userId: string,
  db?: D1Database
): Promise<AIProviderConfig[]> {
  // Check if comment analysis is allowed (defaults to true)
  let allowCommentAnalysis = true;
  let userRecord: any = null;
  if (db) {
    userRecord = await getUserRecord(db, supabase, userId);
    if (userRecord && userRecord.allow_comment_analysis !== undefined && userRecord.allow_comment_analysis !== null) {
      allowCommentAnalysis = userRecord.allow_comment_analysis === 1 || userRecord.allow_comment_analysis === true;
    }
  } else {
    try {
      const { data: res } = await supabase
        .from('users')
        .select('allow_comment_analysis, settings')
        .eq('id', userId)
        .maybeSingle();
      userRecord = res;
      if (userRecord && userRecord.allow_comment_analysis !== null && userRecord.allow_comment_analysis !== undefined) {
        allowCommentAnalysis = userRecord.allow_comment_analysis;
      }
    } catch (_) {}
  }

  if (allowCommentAnalysis && userRecord && isFeatureDisabledByUser(userRecord, 'allow_comment_analysis')) {
    allowCommentAnalysis = false;
  }

  if (!allowCommentAnalysis) {
    console.warn(`[AI] ⚠️ Comment analysis is disabled for user ${userId}. Returning empty chain.`);
    return [];
  }

  return getProviderChainForRole(supabase, userId, 'comment_analysis', db);
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
    fallbackImageOrder: row.fallback_image_order ?? null,
    fallbackContentOrder: row.fallback_content_order ?? null,
    is_active_chat: row.is_active_chat === true || (row.is_active_chat as any) === 1,
    is_active_embedding: row.is_active_embedding === true || (row.is_active_embedding as any) === 1,
    is_active_summarization: row.is_active_summarization === true || (row.is_active_summarization as any) === 1,
    is_active_agent: row.is_active_agent === true || (row.is_active_agent as any) === 1,
    is_active_vision: row.is_active_vision === true || (row.is_active_vision as any) === 1,
    is_active_image: row.is_active_image === true || (row.is_active_image as any) === 1,
    is_active_content: row.is_active_content === true || (row.is_active_content as any) === 1,
  };
}

/**
 * Load the image generation provider chain.
 */
export async function getImageProviderChain(
  supabase: SupabaseClient,
  userId: string,
  db?: D1Database
): Promise<AIProviderConfig[]> {
  // Check if image generation is allowed (defaults to true)
  let allowImageGen = true;
  let userRecord: any = null;
  if (db) {
    userRecord = await getUserRecord(db, supabase, userId);
    if (userRecord && userRecord.allow_image_gen !== undefined && userRecord.allow_image_gen !== null) {
      allowImageGen = userRecord.allow_image_gen === 1 || userRecord.allow_image_gen === true;
    }
  } else {
    try {
      const { data: res } = await supabase
        .from('users')
        .select('allow_image_gen, settings')
        .eq('id', userId)
        .maybeSingle();
      userRecord = res;
      if (userRecord && userRecord.allow_image_gen !== null && userRecord.allow_image_gen !== undefined) {
        allowImageGen = userRecord.allow_image_gen;
      }
    } catch (_) {}
  }

  if (allowImageGen && userRecord && isFeatureDisabledByUser(userRecord, 'allow_image_gen')) {
    allowImageGen = false;
  }

  if (!allowImageGen) {
    console.warn(`[AI] ⚠️ Image generation is disabled for user ${userId}. Returning empty chain.`);
    return [];
  }

  return getProviderChainForRole(supabase, userId, 'image', db);
}

/**
 * Load the active image generation provider.
 */
export async function getActiveImageProvider(
  supabase: SupabaseClient,
  userId: string,
  db?: D1Database
): Promise<AIProviderConfig | null> {
  const chain = await getImageProviderChain(supabase, userId, db);
  return chain[0] || null;
}

/**
 * Load the content provider chain.
 */
export async function getContentProviderChain(
  supabase: SupabaseClient,
  userId: string,
  db?: D1Database
): Promise<AIProviderConfig[]> {
  // Check if content creation is allowed (defaults to true)
  let allowContent = true;
  let userRecord: any = null;
  if (db) {
    userRecord = await getUserRecord(db, supabase, userId);
    if (userRecord && userRecord.allow_content !== undefined && userRecord.allow_content !== null) {
      allowContent = userRecord.allow_content === 1 || userRecord.allow_content === true;
    }
  } else {
    try {
      const { data: res } = await supabase
        .from('users')
        .select('allow_content, settings')
        .eq('id', userId)
        .maybeSingle();
      userRecord = res;
      if (userRecord && userRecord.allow_content !== null && userRecord.allow_content !== undefined) {
        allowContent = userRecord.allow_content;
      }
    } catch (_) {}
  }

  if (allowContent && userRecord && isFeatureDisabledByUser(userRecord, 'allow_content')) {
    allowContent = false;
  }

  if (!allowContent) {
    console.warn(`[AI] ⚠️ Content creation is disabled for user ${userId}. Returning empty chain.`);
    return [];
  }

  return getProviderChainForRole(supabase, userId, 'content', db);
}

/**
 * Load the active content provider.
 */
export async function getActiveContentProvider(
  supabase: SupabaseClient,
  userId: string,
  db?: D1Database
): Promise<AIProviderConfig | null> {
  const chain = await getContentProviderChain(supabase, userId, db);
  return chain[0] || null;
}
