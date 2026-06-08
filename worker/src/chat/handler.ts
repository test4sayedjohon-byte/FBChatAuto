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
import { getAllChatProviders, getActiveEmbeddingProvider, getProviderById, getActiveVisionProvider } from '../ai/provider';
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
  userMessage: string,
  senderId: string
): Promise<ChatHandlerResult> {
  const userId = pageConnection.user_id;

  // 1. Load all available chat providers for fallback
  let chatProviders = await getAllChatProviders(supabase, userId);

  // If this specific page has a dedicated AI provider assigned, fetch it and prepend it
  if (pageConnection.ai_provider_id) {
    try {
      const pageProvider = await getProviderById(supabase, pageConnection.ai_provider_id);
      if (pageProvider) {
        chatProviders = [
          pageProvider,
          ...chatProviders.filter(p => p.id !== pageProvider.id)
        ];
      }
    } catch (err) {
      console.error('[Chat] Failed to fetch page-specific provider:', err);
    }
  }

  if (!chatProviders || chatProviders.length === 0) {
    console.warn(`[Chat] No AI providers configured for user ${userId}`);
    return {
      reply: "I'm sorry, but I'm not fully set up yet. Please contact the business directly for assistance.",
      sessionId,
      ragUsed: false,
      provider: 'none',
      model: 'none',
    };
  }

  // 1b. Check user monthly token limits
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: userData } = await supabase
      .from('users')
      .select('monthly_token_limit, strict_token_enforcement')
      .eq('id', userId)
      .maybeSingle();

    const monthlyLimit = userData?.monthly_token_limit ?? 500000;
    const strictEnforcement = userData?.strict_token_enforcement ?? true;

    // Get total token usage for the month via DB-side SUM (uses composite index)
    const { data: usageResult } = await supabase.rpc('get_monthly_token_usage', {
      p_user_id: userId,
      p_month_start: startOfMonth.toISOString(),
    });

    const currentUsage = typeof usageResult === 'number' ? usageResult : 0;

    if (currentUsage >= monthlyLimit) {
      console.warn(`[Chat] Tenant ${userId} has exceeded monthly token limit: ${currentUsage} >= ${monthlyLimit}`);
      if (strictEnforcement) {
        return {
          reply: "System notice: monthly AI response quota exceeded. Please contact support.",
          sessionId,
          ragUsed: false,
          provider: 'limit-enforced',
          model: 'none',
          tokensUsed: 0,
        };
      }
    }
  } catch (quotaErr) {
    console.error('[Chat] Failed checking token quota limits, continuing execution:', quotaErr);
  }

  // 2. Retrieve conversation history (context window)
  const { data: historyRows } = await supabase.rpc('get_session_context', {
    p_session_id: sessionId,
    p_limit: chatProviders[0].contextWindow,
  });

  const rows = historyRows ?? [];

  // Determine if vision is needed: check if any user message since the last assistant/human reply has attachments
  let needsVision = false;
  for (const row of rows) {
    if (row.role === 'assistant' || row.role === 'human_agent') {
      break; // Stop at the last response
    }
    if (row.role === 'user' && row.metadata?.attachment_urls?.length > 0) {
      needsVision = true;
      break;
    }
  }

  // Convert DB rows to ChatMessage format (reverse to chronological order)
  const history: ChatMessage[] = [...rows]
    .reverse()
    .map((row: any) => {
      let finalContent: any = row.content;

      // If this message has attachments
      if (row.metadata?.attachment_urls?.length > 0) {
        if (needsVision) {
          // Multimodal format for vision models
          finalContent = [];
          if (row.content && !row.content.startsWith('[Attachment:')) {
            finalContent.push({ type: 'text', text: row.content });
          } else {
            // Always include a text part — many models reject image-only arrays
            finalContent.push({ type: 'text', text: 'What is in this image? Describe what you see and respond helpfully.' });
          }
          for (const url of row.metadata.attachment_urls) {
            finalContent.push({ type: 'image_url', image_url: { url } });
          }
        } else {
          // Plain text fallback for text-only models to avoid 400 Bad Request
          if (row.content && !row.content.startsWith('[Attachment:')) {
            finalContent = `${row.content} [Attached Image]`;
          } else {
            finalContent = '[Attached Image]';
          }
        }
      }

      return {
        // The AI API only accepts 'user', 'assistant', or 'system'. 
        // If a human agent sent a message, we tell the AI that the 'assistant' sent it
        role: (row.role === 'human_agent' ? 'assistant' : row.role) as 'user' | 'assistant',
        content: finalContent,
      };
    });

  // If vision is needed for the current message, find a dedicated vision provider.
  // IMPORTANT: When needsVision=true, we ONLY try the vision provider.
  // Do NOT fall back through text-only providers — each has a 30s timeout, and
  // cascading through all of them (with multimodal payloads they can't process)
  // causes the Cloudflare Worker to time out before sending any reply.
  if (needsVision) {
    const humanVisionReplies = [
      "Thanks for sharing! 🖼️ I can't quite view images directly at the moment. Could you type out a quick description of it for me?",
      "I see you sent an image! 📷 Unfortunately, I'm unable to analyze images right now. If you have a question about it, please describe it in text!",
      "Appreciate the image! 🖼️ I'm currently unable to view or process photos. Could you tell me a bit about what's in the image?",
      "I received your photo! 📸 However, I can't process images at this time. Could you describe what you need help with in writing?",
      "Nice picture! 🖼️ I'm not able to view attachments right now. Could you please explain what is in the image in text?",
      "Got your image! 📷 My vision features are currently offline, so I can't view it. Please type out a description of what you'd like me to look at!",
      "Thanks for sending! 🖼️ I don't have the ability to view photos right now. If you can describe it in text, I'd be happy to help!",
      "I see the attachment! 📸 I'm only able to read text messages at the moment. Can you tell me what the image shows?"
    ];

    const getRandomVisionReply = () => {
      const idx = Math.floor(Math.random() * humanVisionReplies.length);
      return humanVisionReplies[idx];
    };

    const visionProvider = await getActiveVisionProvider(supabase, userId);

    const visionCannedReply = async (reason: string): Promise<ChatHandlerResult> => {
      const msg = getRandomVisionReply();
      console.warn(`[Chat] ⚠️ Vision failed: ${reason}. Returning canned reply.`);
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        user_id: userId,
        role: 'assistant',
        content: msg,
        metadata: { provider: 'vision-failed', model: 'canned', rag_used: false, reason },
      });
      return { reply: msg, sessionId, ragUsed: false, provider: 'vision-failed', model: 'canned' };
    };

    if (!visionProvider) {
      const noConfigMsg = getRandomVisionReply();
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        user_id: userId,
        role: 'assistant',
        content: noConfigMsg,
        metadata: { provider: 'vision-not-configured', model: 'canned', rag_used: false },
      });
      return { reply: noConfigMsg, sessionId, ragUsed: false, provider: 'vision-not-configured', model: 'canned' };
    }

    // Check vision quota limits
    try {
      const { data: userProfile } = await supabase
        .from('users')
        .select('vision_monthly_limit, vision_queries_used, vision_extra_queries, vision_usage_month')
        .eq('id', userId)
        .maybeSingle();

      const currentMonth = new Date().toISOString().slice(0, 7);
      let {
        vision_monthly_limit = 30,
        vision_queries_used = 0,
        vision_extra_queries = 0,
        vision_usage_month
      } = userProfile || {};

      if (vision_usage_month !== currentMonth) {
        vision_queries_used = 0;
        vision_extra_queries = 0;
        vision_usage_month = currentMonth;
      }

      let hasQuota = false;
      if (vision_queries_used < vision_monthly_limit) {
        vision_queries_used++;
        hasQuota = true;
      } else if (vision_extra_queries > 0) {
        vision_extra_queries--;
        hasQuota = true;
      }

      if (!hasQuota) {
        const quotaMsg = getRandomVisionReply();
        await supabase.from('chat_messages').insert({
          session_id: sessionId,
          user_id: userId,
          role: 'assistant',
          content: quotaMsg,
          metadata: { provider: 'vision-limit-exceeded', model: 'canned', rag_used: false },
        });
        return { reply: quotaMsg, sessionId, ragUsed: false, provider: 'vision-limit-exceeded', model: 'canned' };
      }

      // Update vision usage in database
      await supabase
        .from('users')
        .update({
          vision_queries_used,
          vision_extra_queries,
          vision_usage_month
        })
        .eq('id', userId);
    } catch (quotaErr) {
      console.error('[Chat] Failed checking vision quota limits, continuing execution:', quotaErr);
    }

    // Try ONLY the vision provider — fail fast instead of cascading through text providers
    console.log(`[Chat] 👁️ Vision required. Using: ${visionProvider.providerName} (${visionProvider.modelChat})`);
    try {
      const systemPrompt = await buildSystemPrompt(supabase, pageConnection, senderId, undefined);
      const visionMessages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...history];
      const response = await callChatCompletion(visionProvider, visionMessages, { maxTokens: 1024 });
      const reply = response.choices?.[0]?.message?.content ?? "I'm sorry, I couldn't analyze the image. Please try again.";
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        user_id: userId,
        role: 'assistant',
        content: reply,
        token_count: response.usage?.total_tokens ?? response.usage?.completion_tokens,
        metadata: { provider: visionProvider.providerName, model: response.model, tokens: response.usage, rag_used: false },
      });
      console.log(`[Chat] ✅ Vision response generated via ${visionProvider.providerName}`);
      return { reply, sessionId, tokensUsed: response.usage?.total_tokens, ragUsed: false, provider: visionProvider.providerName, model: visionProvider.modelChat };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error(`[Chat] ❌ Vision provider failed:`, errMsg);
      return visionCannedReply(errMsg.substring(0, 120));
    }
  }


  console.log(`[Chat] Loaded ${history.length} messages from session context`);

  // 3. Determine if we need RAG
  // For messages with text (even if they also have images), use the text for RAG.
  // Only skip RAG when the message is purely attachment-only with no user text.
  const ragQuery = userMessage.startsWith('[Attachment:') || userMessage.startsWith('[Shared')
    ? '' // No meaningful text to embed
    : userMessage.replace(/\[Shared:.*?\]/g, '').replace(/\[Shared Link:.*?\]/g, '').trim(); // Strip link annotations, keep user text
  let ragContext: string | undefined;
  let ragUsed = false;

  if (ragQuery && shouldTriggerRAG(ragQuery, history)) {
    console.log('[Chat] RAG triggered — searching knowledge base');

    const embeddingProvider = await getActiveEmbeddingProvider(supabase, userId);

    if (embeddingProvider && embeddingProvider.modelEmbedding) {
      try {
        const ragResults = await searchDocuments(
          supabase,
          embeddingProvider,
          userId,
          ragQuery,
          pageConnection.page_id,
          0.4, // Low threshold to ensure short/simple docs are still retrieved
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
  const systemPrompt = await buildSystemPrompt(supabase, pageConnection, senderId, ragContext);

  // 5. Construct the final messages array
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
  ];

  // 6. Iterate through providers until one succeeds
  for (const chatProvider of chatProviders) {
    try {
      const isPrimary = (pageConnection.ai_provider_id === chatProvider.id) || 
                        (!pageConnection.ai_provider_id && chatProvider.id === chatProviders[0]?.id);

      const executionProvider = { ...chatProvider };
      if (isPrimary) {
        if (pageConnection.ai_model) {
          executionProvider.modelChat = pageConnection.ai_model;
        }
        if (pageConnection.temperature !== undefined && pageConnection.temperature !== null) {
          executionProvider.temperature = pageConnection.temperature;
        }
      }

      console.log(`[Chat] Trying provider: ${executionProvider.providerName} (${executionProvider.modelChat}) at t=${executionProvider.temperature}`);

      const response = await callChatCompletion(executionProvider, messages);

      const reply = response.choices?.[0]?.message?.content ?? "I'm sorry, I couldn't generate a response. Please try again.";
      const tokensUsed = response.usage?.total_tokens;

      // 7. Store the assistant's reply in the database
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        user_id: userId,
        role: 'assistant',
        content: reply,
        token_count: response.usage?.total_tokens ?? response.usage?.completion_tokens,
        metadata: {
          provider: chatProvider.providerName,
          model: response.model,
          tokens: response.usage,
          rag_used: ragUsed,
        },
      });

      console.log(`[Chat] ✅ AI response generated (${tokensUsed ?? '?'} tokens, RAG: ${ragUsed}) via ${chatProvider.providerName}`);

      return {
        reply,
        sessionId,
        tokensUsed,
        ragUsed,
        provider: executionProvider.providerName,
        model: executionProvider.modelChat,
      };
    } catch (error) {
      if (error instanceof AIProviderError) {
        console.error(`[Chat] ❌ AI provider error (${error.provider}, ${error.status}):`, error.message);
      } else {
        console.error(`[Chat] ❌ Unexpected error with provider ${chatProvider.providerName}:`, error);
      }
      console.log(`[Chat] Falling back to next provider...`);
      // Continue to the next provider in the loop
    }
  }

  // If all providers fail
  console.error('[Chat] ❌ All available AI providers failed.');
  return {
    reply: "I'm experiencing some technical difficulties right now. Please try again in a moment, or contact the business directly.",
    sessionId,
    ragUsed: false,
    provider: 'failed',
    model: 'failed',
  };
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

  // Skip very short messages (likely greetings like "hi", "ok")
  if (normalizedMessage.length < 5) {
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
