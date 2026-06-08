import type { SupabaseClient } from '@supabase/supabase-js';
import type { PageConnection } from '../types';
import { callChatCompletion } from '../ai/client';
import { getActiveChatProvider } from '../ai/provider';

export async function triggerSlidingWindowSummarization(
  supabase: SupabaseClient,
  sessionId: string,
  pageConnection: PageConnection,
  senderId: string,
  forceLeftover: boolean = false
) {
  if (pageConnection.enable_customer_profiling !== true) return;

  const contextWindow = 10;

  try {
    const { count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    if (!count) return;

    let rangeStart = count - contextWindow;
    let rangeEnd = count - 1;

    if (forceLeftover) {
      const leftover = count % contextWindow;
      if (leftover === 0) return; // Nothing leftover to summarize
      rangeStart = count - leftover;
    } else {
      if (count % contextWindow !== 0) return;
    }

    // Fetch the N messages that just formed the window
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .range(rangeStart, rangeEnd);

    if (!messages || messages.length === 0) return;

    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('summary')
      .eq('page_id', pageConnection.page_id)
      .eq('sender_id', senderId)
      .maybeSingle();

    const existingSummary = profile?.summary || 'No previous summary.';

    const promptText = `You are a CRM AI. Summarize the customer's profile, preferences, and key details based on the old summary and the new messages. 
Return ONLY a strictly formatted Markdown paragraph. Use bullet points and bold text for key details to make it easily scannable. Do not use conversational filler.

OLD SUMMARY:
${existingSummary}

NEW MESSAGES:
${messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
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

    const newSummary = response.choices?.[0]?.message?.content?.trim();

    if (newSummary) {
      await supabase.from('customer_profiles').upsert({
        user_id: pageConnection.user_id,
        page_id: pageConnection.page_id,
        sender_id: senderId,
        summary: newSummary,
        updated_at: new Date().toISOString()
      }, { onConflict: 'page_id, sender_id' });
      
      console.log(`[Summarize] ✅ Updated customer profile for ${senderId}`);
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
