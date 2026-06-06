// ============================================================================
// AI Provider Types
// ============================================================================

/**
 * Normalized AI provider configuration.
 * Loaded from the `ai_providers` table in Supabase.
 */
export interface AIProviderConfig {
  id: string;
  userId: string;
  providerName: string;       // 'openai' | 'openrouter' | 'gemini' | 'groq' | 'anthropic' | 'together' | 'deepseek' | 'mistral' | 'custom'
  displayName: string;
  baseUrl: string;            // OpenAI-compatible base URL
  apiKey: string;
  modelChat: string;          // Chat model name
  modelEmbedding: string;     // Embedding model name
  maxTokens: number;
  temperature: number;
  contextWindow: number;      // Number of recent messages to include
  extraHeaders: Record<string, string>;
}

/**
 * OpenAI-compatible chat message format.
 * Used by ALL providers (OpenAI, OpenRouter, Gemini, Groq, etc.).
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * OpenAI-compatible chat completion response.
 */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Well-known provider presets with default base URLs and recommended models.
 */
export const PROVIDER_PRESETS: Record<string, {
  baseUrl: string;
  defaultChatModel: string;
  defaultEmbeddingModel: string;
  extraHeaders?: Record<string, string>;
}> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultChatModel: 'gpt-4o-mini',
    defaultEmbeddingModel: 'text-embedding-3-small',
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultChatModel: 'openai/gpt-4o-mini',
    defaultEmbeddingModel: 'openai/text-embedding-3-small',
    extraHeaders: {
      'HTTP-Referer': 'https://autometabot.com',
      'X-Title': 'AutometaBot',
    },
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultChatModel: 'gemini-2.0-flash',
    defaultEmbeddingModel: 'text-embedding-004',
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultChatModel: 'llama-3.1-8b-instant',
    defaultEmbeddingModel: '', // Groq doesn't have embeddings — user must use another provider
  },
  together: {
    baseUrl: 'https://api.together.xyz/v1',
    defaultChatModel: 'meta-llama/Llama-3.1-8B-Instruct-Turbo',
    defaultEmbeddingModel: 'togethercomputer/m2-bert-80M-8k-retrieval',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    defaultChatModel: 'deepseek-chat',
    defaultEmbeddingModel: '', // DeepSeek doesn't have embeddings
  },
  mistral: {
    baseUrl: 'https://api.mistral.ai/v1',
    defaultChatModel: 'mistral-small-latest',
    defaultEmbeddingModel: 'mistral-embed',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    defaultChatModel: 'claude-sonnet-4-20250514',
    defaultEmbeddingModel: '', // Anthropic doesn't have embeddings
  },
};
