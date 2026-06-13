// ============================================================================
// AI Follow-Up Automation — Background Sweeper & Generator
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppEnv } from '../types';
import { verifyAndDeductCredits } from '../credits';
import { sendFacebookReply } from '../facebook';
import { getAllChatProviders, getEmbeddingProviderChain } from '../ai/provider';
import { callChatCompletion } from '../ai/client';
import { searchDocuments } from '../rag/pipeline';
import { buildSystemPrompt } from './prompt';
import type { ChatMessage } from '../ai/types';
import {
  getSessionContextFallback,
  storeAssistantMessageFallback
} from '../db';

/**
 * Sweeper function called by the Cloudflare Worker Cron handler.
 * Scans active sessions for idle threads that require follow-up.
 */
export async function runFollowUpSweeper(
  supabase: SupabaseClient,
  env: AppEnv['Bindings']
): Promise<void> {
  try {
    console.log('[Follow-up Sweeper] 🔎 Checking for idle conversations...');

    // 1. Fetch all page connections with follow-up active
    const { data: pageConnections, error: pageErr } = await supabase
      .from('page_connections')
      .select('*')
      .eq('follow_up_enabled', true)
      .eq('is_active', true);

    if (pageErr) {
      console.error('[Follow-up Sweeper] Error loading page connections:', pageErr.message);
      return;
    }

    if (!pageConnections || pageConnections.length === 0) {
      console.log('[Follow-up Sweeper] No active follow-up configurations found.');
      return;
    }

    const now = new Date();

    for (const pageConn of pageConnections) {
      const delayMinutes = pageConn.follow_up_delay_minutes || 60;
      const maxFollowUps = pageConn.follow_up_max_count || 1;

      // Calculate lower & upper time bounds to prevent triggering multiple times
      // or picking up stale conversations from days ago in case of worker downtime.
      const delayMs = delayMinutes * 60 * 1000;
      const cutoffTime = new Date(now.getTime() - delayMs).toISOString();
      const upperTimeLimit = new Date(now.getTime() - delayMs - 120 * 60 * 1000).toISOString(); // 2 hours window

      console.log(`[Follow-up Sweeper] Scanning page ${pageConn.page_name || pageConn.page_id} (delay=${delayMinutes}m)`);

      // 2. Fetch candidate sessions for this page
      const { data: sessions, error: sessionErr } = await supabase
        .from('chat_sessions')
        .select('id, page_id, sender_id, user_id, last_message_at, follow_up_count')
        .eq('page_id', pageConn.page_id)
        .eq('status', 'active')
        .eq('bot_paused', false)
        .lt('follow_up_count', maxFollowUps)
        .lt('last_message_at', cutoffTime)
        .gt('last_message_at', upperTimeLimit);

      if (sessionErr) {
        console.error(`[Follow-up Sweeper] Error querying sessions for page ${pageConn.page_id}:`, sessionErr.message);
        continue;
      }

      if (!sessions || sessions.length === 0) {
        continue;
      }

      // 2b. Filter sessions by lead score if page connection specifies a min score > 1
      let sessionsToFollowUp = sessions;
      const minScore = pageConn.follow_up_min_score || 1;
      if (minScore > 1) {
        const senderIds = sessions.map(s => s.sender_id);
        const { data: profiles, error: profErr } = await supabase
          .from('customer_profiles')
          .select('sender_id, lead_score')
          .eq('page_id', pageConn.page_id)
          .in('sender_id', senderIds);

        if (!profErr && profiles) {
          const profileMap = new Map(profiles.map(p => [p.sender_id, p.lead_score ?? 5]));
          sessionsToFollowUp = sessions.filter(s => {
            const score = profileMap.get(s.sender_id);
            // Default new sessions without a profile to score 5 (warm)
            const actualScore = score !== undefined ? score : 5;
            return actualScore >= minScore;
          });
        }
      }

      if (sessionsToFollowUp.length === 0) {
        continue;
      }

      console.log(`[Follow-up Sweeper] Found ${sessionsToFollowUp.length} candidate sessions for page ${pageConn.page_name || pageConn.page_id} (filtered from ${sessions.length})`);

      // We process sessions serially or up to a safety limit (to prevent Cloudflare timeout)
      const sessionsToProcess = sessionsToFollowUp.slice(0, 3);

      for (const session of sessionsToProcess) {
        try {
          await processSessionFollowUp(supabase, session, pageConn, env);
        } catch (err: any) {
          console.error(`[Follow-up Sweeper] ❌ Failed to execute follow-up for session ${session.id}:`, err.message);
        }
      }
    }
  } catch (error: any) {
    console.error('[Follow-up Sweeper] ❌ Sweeper crashed:', error.message);
  }
}

/**
 * Handle execution of the follow-up response for a single session.
 */
async function processSessionFollowUp(
  supabase: SupabaseClient,
  session: any,
  pageConnection: any,
  env: AppEnv['Bindings']
): Promise<void> {
  const userId = session.user_id;
  const sessionId = session.id;

  // 1. Get chat history & check the last message
  const chatProviders = await getAllChatProviders(supabase, userId, env.DB);
  if (!chatProviders || chatProviders.length === 0) {
    console.warn(`[Follow-up] No chat providers for user ${userId}`);
    return;
  }

  const limit = chatProviders[0].contextWindow;
  const rows = env.DB 
    ? await getSessionContextFallback(env.DB, supabase, sessionId, limit)
    : (await supabase.rpc('get_session_context', { p_session_id: sessionId, p_limit: limit })).data || [];

  if (rows.length === 0) return;

  const lastMsg = rows[0]; // first row is the newest message
  
  // Guard clause: Only follow up if the last message was from the business/bot, or if it has been idle.
  // We don't want to follow up if a human is in the middle of active manual takeover, but RLS/bot_paused already handles that.
  // Still, let's verify if the last message wasn't a follow-up already or if it's user who was answered.
  if (lastMsg.role === 'user') {
    // If the last message was a user message, the webhook is expected to answer or is processing it.
    // However, if it has been idle for hours, it means the bot failed to reply.
    // In that case, we can proceed with a follow-up nudge or standard reply.
  }

  // 2. Perform credit check and deduction before calling AI (Cost = 1 credit for standard text)
  const cost = 1;
  const creditRes = await verifyAndDeductCredits(supabase, userId, cost);
  if (!creditRes.success) {
    console.warn(`[Follow-up] User ${userId} failed credit check: ${creditRes.error}`);
    return;
  }

  // 3. Perform RAG/Knowledge search if we have custom follow-up prompt
  const followUpPrompt = pageConnection.follow_up_prompt || 'Politely follow up with the user to see if they have any other questions.';
  let ragContext: string | undefined;

  const embeddingChain = await getEmbeddingProviderChain(supabase, userId, env.DB);
  if (embeddingChain.length > 0) {
    try {
      const ragResults = await searchDocuments(
        supabase,
        embeddingChain,
        userId,
        followUpPrompt,
        pageConnection.page_id,
        0.0,
        3
      );
      if (ragResults.length > 0) {
        ragContext = ragResults
          .map((r, i) => `[Source ${i + 1}] (Relevance: ${(r.similarity * 100).toFixed(0)}%)\n${r.content}`)
          .join('\n\n---\n\n');
      }
    } catch (ragErr) {
      console.error('[Follow-up] RAG search failed, continuing without:', ragErr);
    }
  }

  // 4. Construct System Prompt & Messages
  const systemPrompt = await buildSystemPrompt(supabase, pageConnection, session.sender_id, ragContext, env.DB);
  
  // Inject strict instructions on how to follow up
  const followUpDirective = `\n\n[FOLLOW-UP INSTRUCTIONS: The customer has been idle/left the chat. You must follow up based on this guideline: "${followUpPrompt}". Maintain the previous persona and language. Reply in strict plain text without markdown (do NOT use **, #, or bullet lists).]`;

  // History format (reverse to chronological)
  const history: ChatMessage[] = [...rows]
    .reverse()
    .map((row: any) => ({
      role: (row.role === 'human_agent' ? 'assistant' : row.role) as 'user' | 'assistant',
      content: row.content,
    }));

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    {
      role: 'user',
      content: `[System Instruction: The customer has been silent. Please send a polite, human-like follow-up message now based on these guidelines: "${followUpPrompt}". Maintain the active language and bot persona. Reply in plain text without markdown (do NOT use **, #, or bullet lists).]`
    }
  ];

  // 5. Generate Response via LLM
  let replyText = '';
  let providerName = 'unknown';
  let modelName = 'unknown';
  let tokensUsed = 0;

  for (const provider of chatProviders) {
    try {
      const response = await callChatCompletion(provider, messages);
      replyText = response.choices?.[0]?.message?.content || '';
      providerName = provider.providerName;
      modelName = response.model || provider.modelChat;
      tokensUsed = response.usage?.total_tokens || 0;
      break; // Success!
    } catch (err) {
      console.warn(`[Follow-up] Provider ${provider.providerName} failed:`, err);
    }
  }

  if (!replyText) {
    console.error(`[Follow-up] All AI providers failed to generate message for session ${sessionId}`);
    return;
  }

  // 6. Send the message to Facebook Graph API
  const sendRes = await sendFacebookReply(
    pageConnection.access_token,
    session.sender_id,
    replyText,
    pageConnection.page_id
  );

  if (!sendRes.success) {
    console.error(`[Follow-up] Failed to deliver Messenger reply for session ${sessionId}:`, sendRes.error);
    return;
  }

  // 7. Store assistant's reply in database
  const metadata = {
    provider: providerName,
    model: modelName,
    rag_used: !!ragContext,
    is_follow_up: true,
    credits_deducted: cost
  };

  if (env.DB) {
    await storeAssistantMessageFallback(env.DB, supabase, sessionId, userId, replyText, tokensUsed, metadata);
  } else {
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: userId,
      role: 'assistant',
      content: replyText,
      token_count: tokensUsed,
      metadata
    });
  }

  // 8. Increment session follow-up count & update last_message_at
  const nextCount = (session.follow_up_count || 0) + 1;
  const { error: updateErr } = await supabase
    .from('chat_sessions')
    .update({
      follow_up_count: nextCount,
      last_follow_up_at: new Date().toISOString(),
      last_message_at: new Date().toISOString() // Update to prevent immediate re-trigger next cron run
    })
    .eq('id', sessionId);

  if (updateErr) {
    console.error(`[Follow-up] Failed to update session stats for ${sessionId}:`, updateErr.message);
  } else {
    console.log(`[Follow-up] ✅ Successfully followed up for session ${sessionId} (Count: ${nextCount}/${pageConnection.follow_up_max_count})`);
  }
}
