// ============================================================================
// Chat Handler — Main Orchestrator
// ============================================================================
// This is the brain of the system. When a message arrives, it:
//
//   1. Loads the tenant's active AI provider
//   2. Retrieves the last N messages from the session (context window)
//   3. Builds the system prompt (knowledge fields + optional RAG)
//   4. Determines if RAG is needed (smart detection)
//   5. Calls the AI model
//   6. Stores the assistant's reply
//   7. Returns the response text for sending to Facebook
//
// Token Optimization Strategy:
//   - Only the last N messages are sent (configurable per provider)
//   - Knowledge fields are always injected (they're short and critical)
//   - RAG is CONDITIONAL — only triggered when the AI likely needs
//     external knowledge beyond the conversation context
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { getActiveChatProvider, getActiveEmbeddingProvider } from '../ai/provider';
import { callChatCompletion, AIProviderError } from '../ai/client';
import type { ChatMessage } from '../ai/types';
import { searchDocuments } from '../rag/pipeline';
import { buildSystemPrompt } from './prompt';
import type { PageConnection } from '../types';

export interface ChatHandlerResult {
  reply: string;
  sessionId: string;
  tokensUsed?: number;
  ragUsed: boolean;
  provider: string;
  model: string;
}

/**
 * Handle an incoming chat message end-to-end.
 *
 * @param supabase       - Admin Supabase client
 * @param sessionId      - Active chat session ID
 * @param pageConnection - The Facebook Page connection details
 * @param userMessage    - The customer's message text
 */
export async function handleChatMessage(
  supabase: SupabaseClient,
  sessionId: string,
  pageConnection: PageConnection,
  userMessage: string
): Promise<ChatHandlerResult> {
  const userId = pageConnection.user_id;

  // 1. Load the active chat provider
  // Prioritize the page-specific AI model if set, otherwise fallback to tenant active provider
  const chatProvider = await getActiveChatProvider(supabase, userId);
  // (In the future, we could override chatProvider.modelChat with pageConnection.ai_model here)

  if (!chatProvider) {
    console.warn(`[Chat] No AI provider configured for user ${userId}`);
    return {
      reply: "I'm sorry, but I'm not fully set up yet. Please contact the business directly for assistance.",
      sessionId,
      ragUsed: false,
      provider: 'none',
      model: 'none',
    };
  }

  console.log(`[Chat] Using provider: ${chatProvider.providerName} (${chatProvider.modelChat})`);

  // 2. Retrieve conversation history (context window)
  const { data: historyRows } = await supabase.rpc('get_session_context', {
    p_session_id: sessionId,
    p_limit: chatProvider.contextWindow,
  });

  // Convert DB rows to ChatMessage format (reverse to chronological order)
  const history: ChatMessage[] = (historyRows ?? [])
    .reverse()
    .map((row: any) => ({
      role: row.role as 'user' | 'assistant',
      content: row.content,
    }));

  console.log(`[Chat] Loaded ${history.length} messages from session context`);

  // 3. Determine if we need RAG
  let ragContext: string | undefined;
  let ragUsed = false;

  if (shouldTriggerRAG(userMessage, history)) {
    console.log('[Chat] RAG triggered — searching knowledge base');

    const embeddingProvider = await getActiveEmbeddingProvider(supabase, userId);

    if (embeddingProvider && embeddingProvider.modelEmbedding) {
      try {
        const ragResults = await searchDocuments(
          supabase,
          embeddingProvider,
          userId,
          userMessage,
          pageConnection.page_id,
          0.65, // Slightly lower threshold for better recall
          3     // Top 3 results
        );

        if (ragResults.length > 0) {
          ragContext = ragResults
            .map((r, i) => `[Source ${i + 1}] (Relevance: ${(r.similarity * 100).toFixed(0)}%)\n${r.content}`)
            .join('\n\n---\n\n');
          ragUsed = true;
          console.log(`[Chat] RAG found ${ragResults.length} relevant chunks`);
        } else {
          console.log('[Chat] RAG search returned no relevant results');
        }
      } catch (error) {
        console.error('[Chat] RAG search failed, continuing without:', error);
      }
    } else {
      console.log('[Chat] No embedding provider available, skipping RAG');
    }
  } else {
    console.log('[Chat] RAG not needed for this message');
  }

  // 4. Build the system prompt
  const systemPrompt = await buildSystemPrompt(supabase, pageConnection, ragContext);

  // 5. Construct the final messages array
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
  ];

  // 6. Call the AI model
  try {
    const response = await callChatCompletion(chatProvider, messages);

    const reply = response.choices?.[0]?.message?.content ?? "I'm sorry, I couldn't generate a response. Please try again.";
    const tokensUsed = response.usage?.total_tokens;

    // 7. Store the assistant's reply in the database
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: userId,
      role: 'assistant',
      content: reply,
      token_count: response.usage?.completion_tokens,
      metadata: {
        provider: chatProvider.providerName,
        model: response.model,
        tokens: response.usage,
        rag_used: ragUsed,
      },
    });

    console.log(`[Chat] ✅ AI response generated (${tokensUsed ?? '?'} tokens, RAG: ${ragUsed})`);

    return {
      reply,
      sessionId,
      tokensUsed,
      ragUsed,
      provider: chatProvider.providerName,
      model: chatProvider.modelChat,
    };
  } catch (error) {
    if (error instanceof AIProviderError) {
      console.error(`[Chat] ❌ AI provider error (${error.provider}, ${error.status}):`, error.message);
    } else {
      console.error('[Chat] ❌ Unexpected error:', error);
    }

    // Return a graceful fallback
    return {
      reply: "I'm experiencing some technical difficulties right now. Please try again in a moment, or contact the business directly.",
      sessionId,
      ragUsed: false,
      provider: chatProvider.providerName,
      model: chatProvider.modelChat,
    };
  }
}

// ============================================================================
// RAG Trigger Heuristic
// ============================================================================
// Determines whether a message likely needs knowledge from the document store.
// This saves embedding API calls and tokens on simple conversational messages.

/**
 * Decide if RAG should be triggered for this message.
 *
 * Triggers RAG when the user is likely asking a factual/knowledge question:
 *   - Question words (what, how, when, where, why, which, can, do, does, is)
 *   - Keywords suggesting info-seeking (price, cost, hours, policy, shipping, etc.)
 *   - Longer messages (>20 chars) that aren't simple greetings
 *
 * Skips RAG for:
 *   - Very short messages (greetings: "hi", "hello", "thanks")
 *   - Messages that are clearly conversational continuations
 */
function shouldTriggerRAG(message: string, history: ChatMessage[]): boolean {
  const normalizedMessage = message.toLowerCase().trim();

  // Skip very short messages (likely greetings)
  if (normalizedMessage.length < 15) {
    return false;
  }

  // Skip common greetings and acknowledgments
  const greetings = [
    'hi', 'hello', 'hey', 'thanks', 'thank you', 'ok', 'okay', 'cool',
    'great', 'nice', 'good', 'bye', 'goodbye', 'see you', 'yes', 'no',
    'sure', 'alright', 'got it', 'understood', 'perfect', 'awesome',
  ];

  if (greetings.some((g) => normalizedMessage === g || normalizedMessage === g + '!')) {
    return false;
  }

  // Trigger on question patterns
  const questionPatterns = [
    /^(what|how|when|where|why|which|who|can|could|do|does|is|are|will|would)\b/i,
    /\?$/,
    /tell me (about|more)/i,
    /i('d| would) like to (know|learn|understand)/i,
    /explain/i,
    /information (about|on|regarding)/i,
  ];

  if (questionPatterns.some((p) => p.test(normalizedMessage))) {
    return true;
  }

  // Trigger on knowledge-seeking keywords
  const knowledgeKeywords = [
    'price', 'pricing', 'cost', 'fee', 'charge', 'rate',
    'hour', 'hours', 'open', 'close', 'schedule', 'time',
    'policy', 'policies', 'return', 'refund', 'exchange', 'warranty',
    'shipping', 'delivery', 'tracking', 'order',
    'product', 'service', 'feature', 'specification', 'spec',
    'available', 'availability', 'stock',
    'location', 'address', 'direction', 'contact',
    'discount', 'offer', 'deal', 'promotion', 'coupon', 'sale',
    'payment', 'pay', 'method', 'accept',
    'size', 'dimension', 'weight', 'material', 'color', 'colour',
  ];

  if (knowledgeKeywords.some((kw) => normalizedMessage.includes(kw))) {
    return true;
  }

  // For longer messages (>50 chars), assume it might be a detailed question
  if (normalizedMessage.length > 50) {
    return true;
  }

  return false;
}
