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
import { verifyAndDeductCredits } from '../credits';
import { getAllChatProviders, getEmbeddingProviderChain, getProviderById, getActiveVisionProvider } from '../ai/provider';
import { callChatCompletion, AIProviderError } from '../ai/client';
import type { ChatMessage } from '../ai/types';
import { searchDocuments } from '../rag/pipeline';
import { buildSystemPrompt } from './prompt';
import type { PageConnection } from '../types';
import {
  getUserRecord,
  getSessionContextFallback,
  storeAssistantMessageFallback,
  updateMessageMetadataFallback,
  getMediaAssetByNameFallback
} from '../db';

export interface ChatHandlerResult {
  reply: string;
  sessionId: string;
  tokensUsed?: number;
  ragUsed: boolean;
  provider: string;
  model: string;
  attachment?: {
    id: string;
    name: string;
    friendlyName: string;
    fileUrl: string;
    fileType: 'image' | 'video' | 'audio' | 'file';
    facebookMediaId?: string;
  };
  flowId?: string;
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
  senderId: string,
  db?: D1Database,
  aiPromptDirective?: string
): Promise<ChatHandlerResult> {
  const userId = pageConnection.user_id;

  // 1. Load all available chat providers for fallback
  let chatProviders = await getAllChatProviders(supabase, userId, db);

  // If this specific page has a dedicated AI provider assigned, fetch it and prepend it
  if (pageConnection.ai_provider_id) {
    try {
      const pageProvider = await getProviderById(supabase, pageConnection.ai_provider_id, db);
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

  // 2. Retrieve conversation history (context window) first to determine if vision/attachments are present
  let rows: any[] = [];
  if (db) {
    rows = await getSessionContextFallback(db, supabase, sessionId, chatProviders[0].contextWindow);
  } else {
    const { data: historyRows } = await supabase.rpc('get_session_context', {
      p_session_id: sessionId,
      p_limit: chatProviders[0].contextWindow,
    });
    rows = historyRows ?? [];
  }

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

  // Load user profile to check allow_vision and settings
  let allowVision = true;
  if (db) {
    const userRecord = await getUserRecord(db, supabase, userId);
    if (userRecord) {
      const isUserDisabled = userRecord.settings && Array.isArray(userRecord.settings.disabled_features) 
        ? userRecord.settings.disabled_features.includes('allow_vision') 
        : false;
      allowVision = (userRecord.allow_vision === 1 || userRecord.allow_vision === true) && !isUserDisabled;
    }
  } else {
    try {
      const { data: userRecord } = await supabase
        .from('users')
        .select('allow_vision, settings')
        .eq('id', userId)
        .maybeSingle();
      if (userRecord) {
        const isUserDisabled = userRecord.settings && Array.isArray(userRecord.settings.disabled_features) 
          ? userRecord.settings.disabled_features.includes('allow_vision') 
          : false;
        allowVision = !!userRecord.allow_vision && !isUserDisabled;
      }
    } catch (_) {}
  }

  // Calculate cost based on presence of vision/image attachment and whether vision is allowed
  const cost = (needsVision && allowVision) ? 15 : 1;

  // Verify and deduct credits before invoking LLM
  const creditRes = await verifyAndDeductCredits(supabase, userId, cost);
  if (!creditRes.success) {
    console.warn(`[Chat] Tenant ${userId} failed credit check for cost ${cost}: ${creditRes.error}`);
    return {
      reply: "System notice: monthly AI response quota exceeded. Please contact support.",
      sessionId,
      ragUsed: false,
      provider: 'limit-enforced',
      model: 'none',
      tokensUsed: 0,
    };
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

  // Helper to store messages fallback-safely
  const storeMsg = async (role: 'assistant', content: string, tokenCount: number | null, metadata: any) => {
    if (db) {
      await storeAssistantMessageFallback(db, supabase, sessionId, userId, content, tokenCount, metadata);
    } else {
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        user_id: userId,
        role,
        content,
        token_count: tokenCount,
        metadata,
      });
    }
  };

  // If vision is needed for the current message, find a dedicated vision provider.
  // IMPORTANT: When needsVision=true, we ONLY try the vision provider.
  // Do NOT fall back through text-only providers — each has a 30s timeout, and
  // cascading through all of them (with multimodal payloads they can't process)
  // causes the Cloudflare Worker to time out before sending any reply.
  if (needsVision) {
    const humanVisionReplies = [
      "Hey there! I'm having trouble opening that photo on my screen right now. Mind describing what it shows or typing out the details for me?",
      "Thanks for sending that! For some reason, the image isn't loading on my end. Could you tell me a bit about what's in the photo?",
      "I see you sent an attachment, but my chat system is acting up and I can't open it. Can you explain what you need help with in writing?",
      "Got your image, but it's showing up blank on my device. Could you describe the issue or the text in the image so I can help?",
      "Hey! I can't seem to load this photo on my phone right now. Could you please type out what it shows or what your question is about?",
      "Appreciate the picture, but it's not opening for me at the moment. Can you give me a quick description of what's in it?",
      "I received your photo, but my viewer is having issues opening it today. Mind typing out a quick explanation of what you sent?",
      "Hey! I'm on a connection that isn't letting me open images right now. Could you describe what's in the photo or copy the text for me?"
    ];

    const getRandomVisionReply = () => {
      const idx = Math.floor(Math.random() * humanVisionReplies.length);
      return humanVisionReplies[idx];
    };

    if (!allowVision) {
      const disabledMsg = getRandomVisionReply();
      await storeMsg('assistant', disabledMsg, null, { provider: 'vision-disabled', model: 'canned', rag_used: false, credits_deducted: cost });
      return { reply: disabledMsg, sessionId, ragUsed: false, provider: 'vision-disabled', model: 'canned' };
    }

    const visionProvider = await getActiveVisionProvider(supabase, userId, db);

    const visionCannedReply = async (reason: string): Promise<ChatHandlerResult> => {
      const msg = getRandomVisionReply();
      console.warn(`[Chat] ⚠️ Vision failed: ${reason}. Returning canned reply.`);
      await storeMsg('assistant', msg, null, { provider: 'vision-failed', model: 'canned', rag_used: false, reason, credits_deducted: cost });
      return { reply: msg, sessionId, ragUsed: false, provider: 'vision-failed', model: 'canned' };
    };

    if (!visionProvider) {
      const noConfigMsg = getRandomVisionReply();
      await storeMsg('assistant', noConfigMsg, null, { provider: 'vision-not-configured', model: 'canned', rag_used: false, credits_deducted: cost });
      return { reply: noConfigMsg, sessionId, ragUsed: false, provider: 'vision-not-configured', model: 'canned' };
    }

    // Try ONLY the vision provider — fail fast instead of cascading through text providers
    console.log(`[Chat] 👁️ Vision required. Using: ${visionProvider.providerName} (${visionProvider.modelChat})`);
    try {
      const systemPrompt = await buildSystemPrompt(supabase, pageConnection, senderId, undefined, db, aiPromptDirective);
      const visionMessages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...history];
      const response = await callChatCompletion(visionProvider, visionMessages, { maxTokens: 1024 });
      const reply = response.choices?.[0]?.message?.content ?? "I'm sorry, I couldn't analyze the image. Please try again.";
      
      const { finalReply: replyAfterAttach, attachment } = await extractDynamicAttachment(reply, userId, supabase, db);
      const { finalReply, flowId } = await extractDynamicFlowTrigger(replyAfterAttach, userId, supabase, db);

      const msgMetadata: any = {
        provider: visionProvider.providerName,
        model: response.model,
        tokens: response.usage,
        rag_used: false,
        credits_deducted: cost,
      };

      if (attachment) {
        msgMetadata.attachment_types = [attachment.fileType];
        msgMetadata.attachment_urls = [attachment.fileUrl];
      }

      await storeMsg('assistant', finalReply, (response.usage?.total_tokens ?? response.usage?.completion_tokens) ?? null, msgMetadata);
      console.log(`[Chat] ✅ Vision response generated via ${visionProvider.providerName}`);
      return { 
        reply: finalReply, 
        sessionId, 
        tokensUsed: response.usage?.total_tokens, 
        ragUsed: false, 
        provider: visionProvider.providerName, 
        model: visionProvider.modelChat,
        attachment,
        flowId
      };
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

    const embeddingChain = await getEmbeddingProviderChain(supabase, userId, db);

    if (embeddingChain.length > 0) {
      try {
        const ragResults = await searchDocuments(
          supabase,
          embeddingChain,
          userId,
          ragQuery,
          pageConnection.page_id,
          0.0, // Set to 0.0 to ensure multilingual / cross-lingual matches are never filtered out
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
  const systemPrompt = await buildSystemPrompt(supabase, pageConnection, senderId, ragContext, db, aiPromptDirective);

  // 5. Construct the final messages array
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
  ];

  // 5b. Inject a recency-booster language & formatting reminder to the latest user message
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      const userMsg = messages[i];
      const reminder = `\n\n[STRICT REMINDER: Detect the language/script of this message. Reply ONLY in that same language/script (Bengali script, Banglish/Latin letters, or English). Reply in strict plain text without markdown (do NOT use **, #, or bullet lists).]`;
      
      if (typeof userMsg.content === 'string') {
        userMsg.content = userMsg.content + reminder;
      } else if (Array.isArray(userMsg.content)) {
        const textPart = userMsg.content.find((part: any) => part.type === 'text');
        if (textPart) {
          textPart.text = textPart.text + reminder;
        } else {
          userMsg.content.push({ type: 'text', text: reminder });
        }
      }
      break;
    }
  }

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

      const { finalReply: replyAfterAttach, attachment } = await extractDynamicAttachment(reply, userId, supabase, db);
      const { finalReply, flowId } = await extractDynamicFlowTrigger(replyAfterAttach, userId, supabase, db);

      const msgMetadata: any = {
        provider: chatProvider.providerName,
        model: response.model,
        tokens: response.usage,
        rag_used: ragUsed,
        credits_deducted: cost,
      };

      if (attachment) {
        msgMetadata.attachment_types = [attachment.fileType];
        msgMetadata.attachment_urls = [attachment.fileUrl];
      }

      // 7. Store the assistant's reply in the database
      await storeMsg('assistant', finalReply, (response.usage?.total_tokens ?? response.usage?.completion_tokens) ?? null, msgMetadata);

      console.log(`[Chat] ✅ AI response generated (${tokensUsed ?? '?'} tokens, RAG: ${ragUsed}) via ${chatProvider.providerName}`);

      return {
        reply: finalReply,
        sessionId,
        tokensUsed,
        ragUsed,
        provider: executionProvider.providerName,
        model: executionProvider.modelChat,
        attachment,
        flowId
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
    // Pricing, Payment & Earnings
    'price', 'pricing', 'cost', 'fee', 'charge', 'rate', 'payment', 'pay', 'method', 'accept',
    'earn', 'earning', 'earnings', 'income', 'commission', 'profit', 'revenue', 'salary', 'payout', 'withdraw', 'cash',
    'taka', 'money', 'টাকা', 'আয়', 'কমিশন', 'পেমেন্ট', 'টাকায়', 'দাম', 'ইনকাম', 'আর্নিং', 'কত', 'কতো',
    
    // Subscriptions, Plans & Accounts
    'plan', 'plans', 'subscribe', 'subscription', 'membership', 'member', 'renew',
    'login', 'account', 'password', 'signup', 'register', 'signin', 'email', 'user',
    
    // Business Hours, Policies & Operations
    'hour', 'hours', 'open', 'close', 'schedule', 'time', 'date',
    'policy', 'policies', 'return', 'refund', 'exchange', 'warranty', 'guarantee', 'warrenty', 'ওয়ারেন্টি',
    'original', 'real', 'genuine', 'fake', 'সেটআপ', 'সেটাপ',
    
    // Catalog, Features & Availability
    'product', 'service', 'feature', 'specification', 'spec', 'details', 'detail', 'info', 'সার্ভিস',
    'available', 'availability', 'stock', 'size', 'dimension', 'weight', 'material', 'color', 'colour',
    'সাইজ', 'রং', 'কালার', 'পরিমাণ',
    
    // Order, Shipping & Logistics
    'shipping', 'delivery', 'tracking', 'order', 'courier', 'parcel',
    
    // Location, Support & Contact
    'location', 'address', 'direction', 'contact', 'office', 'branch', 'city', 'country', 'dhaka', 'ঢাকা',
    'support', 'help', 'agent', 'human', 'call', 'phone', 'number', 'mobile', 'whatsapp', 'telegram',
    'অফিস', 'মোবাইল', 'যোগাযোগ', 'হেল্প', 'এজেন্ট', 'মেইল', 'লগইন',
    
    // Booking, Bulk & Promotions
    'book', 'booking', 'reserve', 'reservation', 'appointment',
    'bulk', 'wholesale', 'retail', 'discount', 'offer', 'deal', 'promotion', 'coupon', 'promo', 'code', 'অফার'
  ];

  if (knowledgeKeywords.some((kw) => normalizedMessage.includes(kw))) {
    return true;
  }

  // For longer messages (>30 chars), assume it might be a detailed question
  if (normalizedMessage.length > 30) {
    return true;
  }

  return false;
}

/**
 * Helper to check and extract dynamic file triggers of the format [SendFile: asset_name] from the reply.
 */
async function extractDynamicAttachment(
  reply: string,
  userId: string,
  supabase: SupabaseClient,
  db?: D1Database
): Promise<{ finalReply: string; attachment?: any }> {
  let finalReply = reply;
  let matchedAttachment: any = undefined;

  const sendFileRegex = /\[Send(?:File|Media):\s*([a-zA-Z0-9_-]+)\s*\]/i;
  const match = finalReply.match(sendFileRegex);
  if (match) {
    const assetName = match[1];
    console.log(`[Chat] Dynamic file attachment tag detected: ${assetName}`);
    
    let asset = null;
    try {
      if (db) {
        asset = await getMediaAssetByNameFallback(db, supabase, userId, assetName);
      } else {
        const { data } = await supabase
          .from('media')
          .select('id, name, friendly_name, description, file_url, file_type, facebook_media_id')
          .eq('user_id', userId)
          .eq('name', assetName)
          .maybeSingle();
        asset = data;
      }
    } catch (dbErr) {
      console.error('[Chat] Error querying media details:', dbErr);
    }

    if (asset) {
      matchedAttachment = {
        id: asset.id,
        name: asset.name,
        friendlyName: asset.friendly_name,
        fileUrl: asset.file_url,
        fileType: asset.file_type,
        facebookMediaId: asset.facebook_media_id || undefined
      };
    } else {
      console.warn(`[Chat] Dynamic file trigger '${assetName}' did not match any registered asset.`);
    }
    
    // Always strip the tag so the customer doesn't see raw tags
    finalReply = finalReply.replace(sendFileRegex, '').trim();
  }

  return { finalReply, attachment: matchedAttachment };
}

/**
 * Helper to check and extract dynamic flow triggers of the format [StartFlow: flow_name] from the reply.
 */
async function extractDynamicFlowTrigger(
  reply: string,
  userId: string,
  supabase: SupabaseClient,
  db?: D1Database
): Promise<{ finalReply: string; flowId?: string }> {
  let finalReply = reply;
  let flowId: string | undefined = undefined;

  const startFlowRegex = /\[StartFlow:\s*([a-zA-Z0-9_-]+)\s*\]/i;
  const match = finalReply.match(startFlowRegex);
  if (match) {
    const flowName = match[1];
    console.log(`[Chat] Dynamic flow trigger tag detected: ${flowName}`);

    try {
      const { data } = await supabase
        .from('dm_flows')
        .select('id')
        .eq('user_id', userId)
        .eq('name', flowName)
        .maybeSingle();

      if (data) {
        flowId = data.id;
      } else {
        console.warn(`[Chat] Dynamic flow trigger '${flowName}' did not match any active flow.`);
      }
    } catch (err) {
      console.error('[Chat] Error querying dm_flows details:', err);
    }

    finalReply = finalReply.replace(startFlowRegex, '').trim();
  }

  return { finalReply, flowId };
}

