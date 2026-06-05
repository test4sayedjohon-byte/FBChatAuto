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
  }
): Promise<ChatCompletionResponse> {
  const url = `${provider.baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${provider.apiKey}`,
    ...provider.extraHeaders,
  };

  const body = {
    model: provider.modelChat,
    messages,
    max_tokens: options?.maxTokens ?? provider.maxTokens ?? 1024,
    temperature: options?.temperature ?? provider.temperature ?? 0.7,
    stream: options?.stream ?? false,
  };

  console.log(`[AI] Calling ${provider.providerName} (${provider.modelChat}) at ${provider.baseUrl}`);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
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
