import type { SupabaseClient } from '@supabase/supabase-js';
import type { PageConnection } from '../types';
import { callChatCompletion } from '../ai/client';
import { getActiveChatProvider } from '../ai/provider';

export async function triggerSlidingWindowSummarization(
  supabase: SupabaseClient,
  sessionId: string,
  pageConnection: PageConnection,
  senderId: string,
  forceLeftover: boolean = false,
  minUserMessages: number = 10
) {
  if (pageConnection.enable_customer_profiling !== true) return;

  try {
    // 1. Enforce customer messages minimum check
    const { count: userMsgCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('role', 'user');

    if (userMsgCount === null || userMsgCount < minUserMessages) {
      console.log(`[Summarize] User has only sent ${userMsgCount ?? 0} messages. Minimum required is ${minUserMessages}. Skipping.`);
      return;
    }

    // 2. In real-time mode, only run when total message count is a multiple of 10
    if (!forceLeftover) {
      const { count: totalMsgCount } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId);

      if (totalMsgCount === null || totalMsgCount % 10 !== 0) {
        return;
      }
    }

    // Fetch the last 20 messages of the session to get rich context
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!messages || messages.length === 0) return;

    // Reverse the array to put it in chronological order
    const chronologicalMessages = [...messages].reverse();

    // Filter messages to only contain customer messages (role: 'user')
    const customerMessages = chronologicalMessages.filter((m: any) => m.role === 'user');
    if (customerMessages.length === 0) {
      console.log(`[Summarize] No customer messages in the last 20 messages. Skipping.`);
      return;
    }

    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('summary')
      .eq('page_id', pageConnection.page_id)
      .eq('sender_id', senderId)
      .maybeSingle();

    const existingSummary = profile?.summary || 'No previous summary.';

    const promptText = `You are a CRM AI. Analyze the customer's profile, preferences, questions, and key details based on the old summary and the new customer messages.
You must output a strictly formatted JSON object. Do not include any conversational filler, markdown block wraps (except if requested by JSON mode), or trailing text.

Output JSON format:
{
  "summary": "A strictly formatted Markdown summary starting with: '**Intent:** [High/Medium/Low] (Score: [1-10]/10) | **Description:** [3-5 words describing customer]' followed by 3-4 bullet points detailing: what they asked, what they want to know, and their preferences. Focus strictly on what the customer asked, stated, requested, or provided. Do not include AI agent replies.",
  "intent_level": "high" | "medium" | "low" | "unknown",
  "lead_score": 1-10 (a number from 1 to 10: 1-3 = low/generic/greetings, 4-7 = medium/asking specific details, 8-10 = high/buying/ready to purchase),
  "short_description": "A 3-5 word concise description of the user (e.g. 'Dhaka buyer seeking phones')",
  "key_inquiries": "Brief summary of what they asked & want to know"
}

OLD SUMMARY:
${existingSummary}

NEW CUSTOMER MESSAGES:
${customerMessages.map((m: any) => `CUSTOMER: ${m.content}`).join('\n')}
`;

    // Fix H-3: Use tenant-scoped provider resolution (tenant → assigned → global fallback)
    // Fix H-15: This also picks up extraHeaders correctly (e.g., OpenRouter X-Title)
    // Fix L-1: Removed unused getAllChatProviders import
    //
    // Resolution chain:
    //   1. Tenant's dedicated summarization provider (is_active_summarization flag)
    //   2. Per-user assigned summarization provider (assigned_summarization_provider_id)
    //   3. Global summarization provider
    //   4. Active chat provider fallback
    let provider = null;

    // 1. Try tenant's dedicated summarization provider
    const { data: summProvider } = await supabase
      .from('ai_providers')
      .select('*')
      .eq('user_id', pageConnection.user_id)
      .eq('is_active_summarization', true)
      .maybeSingle();

    if (summProvider) {
      provider = rowToProviderConfig(summProvider);
    }

    // 2. Try per-user assigned summarization provider
    if (!provider) {
      const { data: userRecord } = await supabase
        .from('users')
        .select('assigned_summarization_provider_id')
        .eq('id', pageConnection.user_id)
        .maybeSingle();

      if (userRecord?.assigned_summarization_provider_id) {
        const { data: assignedProvider } = await supabase
          .from('ai_providers')
          .select('*')
          .eq('id', userRecord.assigned_summarization_provider_id)
          .maybeSingle();

        if (assignedProvider) {
          provider = rowToProviderConfig(assignedProvider);
        }
      }
    }

    // 3. Try global summarization provider
    if (!provider) {
      const { data: globalSummProvider } = await supabase
        .from('ai_providers')
        .select('*')
        .eq('is_global', true)
        .eq('is_active_summarization', true)
        .maybeSingle();

      if (globalSummProvider) {
        provider = rowToProviderConfig(globalSummProvider);
      }
    }

    // 4. Fall back to the tenant's active chat provider
    if (!provider) {
      provider = await getActiveChatProvider(supabase, pageConnection.user_id);
    }

    if (!provider) {
      console.error(`[Summarize] ❌ No summarization or chat provider found for user ${pageConnection.user_id}`);
      return;
    }

    console.log(`[Summarize] Triggering sliding window summarization for ${senderId} using ${provider.modelChat}`);

    const response = await callChatCompletion(provider, [
      { role: 'user', content: promptText }
    ], { temperature: 0.1 });

    const rawResponse = response.choices?.[0]?.message?.content?.trim() || '';
    let summaryText = '';
    let intentLevel = 'unknown';
    let leadScore = 5;
    let metadata: any = {};

    if (rawResponse) {
      try {
        let jsonStr = rawResponse;
        if (jsonStr.startsWith('```')) {
          const match = jsonStr.match(/```(?:json)?([\s\S]*?)```/);
          if (match) {
            jsonStr = match[1].trim();
          }
        }
        const parsed = JSON.parse(jsonStr);
        summaryText = parsed.summary || '';
        intentLevel = parsed.intent_level || 'unknown';
        leadScore = typeof parsed.lead_score === 'number' ? parsed.lead_score : parseInt(parsed.lead_score || '5', 10);
        if (isNaN(leadScore) || leadScore < 1 || leadScore > 10) {
          leadScore = 5;
        }
        metadata = {
          short_description: parsed.short_description || '',
          key_inquiries: parsed.key_inquiries || '',
          updated_at: new Date().toISOString()
        };
      } catch (jsonErr) {
        console.warn('[Summarize] ⚠️ Failed to parse LLM response as JSON. Treating as raw summary.', jsonErr);
        summaryText = rawResponse;
        // Try regex match fallbacks
        if (/intent_level["'\s:]+(\w+)/i.test(rawResponse)) {
          const match = rawResponse.match(/intent_level["'\s:]+(\w+)/i);
          if (match && ['high', 'medium', 'low', 'unknown'].includes(match[1].toLowerCase())) {
            intentLevel = match[1].toLowerCase();
          }
        }
        if (/lead_score["'\s:]+(\d+)/i.test(rawResponse)) {
          const match = rawResponse.match(/lead_score["'\s:]+(\d+)/i);
          if (match) {
            leadScore = parseInt(match[1], 10);
          }
        }
        metadata = {
          raw: true,
          updated_at: new Date().toISOString()
        };
      }
    }

    if (summaryText) {
      await supabase.from('customer_profiles').upsert({
        user_id: pageConnection.user_id,
        page_id: pageConnection.page_id,
        sender_id: senderId,
        summary: summaryText,
        intent_level: intentLevel,
        lead_score: leadScore,
        metadata: metadata,
        updated_at: new Date().toISOString()
      }, { onConflict: 'page_id, sender_id' });
      
      console.log(`[Summarize] ✅ Updated customer profile for ${senderId} (Score: ${leadScore}, Intent: ${intentLevel})`);
    }
  } catch (error) {
    console.error('[Summarize] ❌ Failed to summarize sliding window:', error);
  }
}

/**
 * Convert a raw DB row to AIProviderConfig, preserving extraHeaders.
 * This avoids the H-15 bug where extraHeaders was hardcoded to {}.
 */
function rowToProviderConfig(row: any) {
  return {
    id: row.id,
    userId: row.user_id ?? 'global',
    providerName: row.provider_name,
    displayName: row.display_name,
    baseUrl: (row.base_url || '').replace(/\/+$/, ''),
    apiKey: row.api_key,
    modelChat: row.model_chat ?? '',
    modelEmbedding: row.model_embedding ?? '',
    maxTokens: row.max_tokens ?? 1024,
    temperature: row.temperature ?? 0.7,
    contextWindow: row.context_window ?? 10,
    extraHeaders: row.extra_headers ?? {},
  };
}
