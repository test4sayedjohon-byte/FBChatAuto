// ============================================================================
// Multi-Provider AI Client — Unified OpenAI-Compatible Interface
// ============================================================================
// All supported providers (OpenAI, OpenRouter, Gemini, Groq, etc.) use the
// OpenAI-compatible chat completions API format. The only differences are:
//   - Base URL
//   - API key
//   - Model name
//   - Optional extra headers (e.g., OpenRouter needs HTTP-Referer)
//
// This module provides a single `callChatCompletion()` function that works
// with ANY OpenAI-compatible provider.
// ============================================================================

import type { AIProviderConfig, ChatMessage, ChatCompletionResponse } from './types';

/**
 * Call the chat completions endpoint for any OpenAI-compatible provider.
 * Works with: OpenAI, OpenRouter, Gemini, Groq, Together, DeepSeek, Mistral, etc.
 */
export async function callChatCompletion(
  provider: AIProviderConfig,
  messages: ChatMessage[],
  options?: {
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
    tools?: any[]; // AITool[]
    toolChoice?: 'auto' | 'none' | { type: 'function', function: { name: string } };
    timeoutMs?: number;
  }
): Promise<ChatCompletionResponse> {
  const url = `${provider.baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${provider.apiKey}`,
    ...provider.extraHeaders,
  };

  // Sanitize messages to remove any extra properties (like 'timestamp') that some providers (e.g. Groq) reject
  const sanitizedMessages = messages.map(m => {
    const clean: any = {
      role: m.role,
      content: m.content
    };
    if (m.name !== undefined) clean.name = m.name;
    if (m.tool_calls !== undefined) clean.tool_calls = m.tool_calls;
    if (m.tool_call_id !== undefined) clean.tool_call_id = m.tool_call_id;
    return clean;
  });

  const body: any = {
    model: provider.modelChat,
    messages: sanitizedMessages,
    max_tokens: options?.maxTokens ?? provider.maxTokens ?? 1024,
    temperature: options?.temperature ?? provider.temperature ?? 0.7,
    stream: options?.stream ?? false,
  };

  if (options?.tools && options.tools.length > 0) {
    body.tools = options.tools;
    if (options.toolChoice) {
      body.tool_choice = options.toolChoice;
    }
  }

  console.log(`[AI] Calling ${provider.providerName} (${provider.modelChat}) at ${provider.baseUrl}`);

  // Dynamic timeout: 30s default, 90s for reasoning models
  const isReasoningModel = provider.modelChat.includes('reason') || 
                           provider.modelChat.includes('o1') || 
                           provider.modelChat.includes('o3') || 
                           provider.modelChat.includes('deepseek-r1') ||
                           provider.modelChat.includes('thinking');
  const timeoutMs = options?.timeoutMs ?? (isReasoningModel ? 90_000 : 30_000);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[AI] ❌ ${provider.providerName} error (${response.status}):`, errorBody);
    throw new AIProviderError(
      `${provider.providerName} returned ${response.status}: ${errorBody}`,
      provider.providerName,
      response.status
    );
  }

  const data = await response.json() as ChatCompletionResponse;

  console.log(`[AI] ✅ Response received — ${data.usage?.total_tokens ?? '?'} tokens used`);

  return data;
}

/**
 * Generate embeddings using any OpenAI-compatible embeddings endpoint.
 */
export async function callEmbedding(
  provider: AIProviderConfig,
  input: string | string[]
): Promise<number[][]> {
  const url = `${provider.baseUrl}/embeddings`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${provider.apiKey}`,
    ...provider.extraHeaders,
  };

  const body = {
    model: provider.modelEmbedding,
    input: Array.isArray(input) ? input : [input],
  };

  console.log(`[AI] Generating embeddings via ${provider.providerName} (${provider.modelEmbedding})`);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000), // 15s timeout
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[AI] ❌ Embedding error (${response.status}):`, errorBody);
    throw new AIProviderError(
      `Embedding failed: ${response.status}: ${errorBody}`,
      provider.providerName,
      response.status
    );
  }

  const data = await response.json() as {
    data: Array<{ embedding: number[]; index: number }>;
  };

  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/**
 * Call the chat completions endpoint with automatic failover support.
 * Iterates through a chain of providers, retrying if one fails.
 */
export async function callChatCompletionWithFailover(
  chain: AIProviderConfig[],
  messages: ChatMessage[],
  options?: Parameters<typeof callChatCompletion>[2]
): Promise<ChatCompletionResponse> {
  if (chain.length === 0) {
    throw new Error('[AI] No active or fallback chat providers configured.');
  }

  let lastError: Error | null = null;

  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    try {
      console.log(`[AI-Failover] Attempt ${i + 1}/${chain.length} using provider ${provider.displayName} (${provider.modelChat})`);
      return await callChatCompletion(provider, messages, options);
    } catch (err: any) {
      console.error(`[AI-Failover] ⚠️ Attempt ${i + 1} with ${provider.displayName} failed:`, err.message || err);
      lastError = err;
      // Continue to next provider in the chain
    }
  }

  throw new Error(`[AI] All chat providers failed. Last error: ${lastError?.message || lastError}`);
}

/**
 * Generate embeddings with automatic failover support.
 */
export async function callEmbeddingWithFailover(
  chain: AIProviderConfig[],
  input: string | string[]
): Promise<number[][]> {
  if (chain.length === 0) {
    throw new Error('[AI] No active or fallback embedding providers configured.');
  }

  let lastError: Error | null = null;

  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    try {
      console.log(`[AI-Failover] Generating embeddings: Attempt ${i + 1}/${chain.length} using provider ${provider.displayName}`);
      return await callEmbedding(provider, input);
    } catch (err: any) {
      console.error(`[AI-Failover] ⚠️ Attempt ${i + 1} with ${provider.displayName} failed:`, err.message || err);
      lastError = err;
    }
  }

  throw new Error(`[AI] All embedding providers failed. Last error: ${lastError?.message || lastError}`);
}

/**
 * Custom error class for AI provider failures.

 * Includes provider name and HTTP status for debugging.
 */
export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}
