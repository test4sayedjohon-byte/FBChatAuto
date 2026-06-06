import type { SupabaseClient } from '@supabase/supabase-js';
import type { PageConnection } from '../types';
import { callChatCompletion } from '../ai/client';
import { getAllChatProviders } from '../ai/provider';

export async function triggerSlidingWindowSummarization(
  supabase: SupabaseClient,
  sessionId: string,
  pageConnection: PageConnection,
  senderId: string
) {
  if (pageConnection.enable_customer_profiling !== true) return;

  const contextWindow = 10;

  try {
    const { count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    if (!count || count % contextWindow !== 0) return;

    // Fetch the N messages that just formed the window
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .range(count - contextWindow, count - 1);

    if (!messages || messages.length === 0) return;

    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('summary')
      .eq('page_id', pageConnection.page_id)
      .eq('sender_id', senderId)
      .maybeSingle();

    const existingSummary = profile?.summary || 'No previous summary.';

    const promptText = `You are a CRM AI. Summarize the customer's profile, preferences, and key details based on the old summary and the new messages. 
Return ONLY a concise text paragraph. Do not use conversational filler.

OLD SUMMARY:
${existingSummary}

NEW MESSAGES:
${messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
`;

    const { data: globalProvider, error: providerErr } = await supabase
      .from('ai_providers')
      .select('*')
      .eq('is_active_summarization', true)
      .maybeSingle();

    if (providerErr || !globalProvider || !globalProvider.model_chat) {
      console.error(`[Summarize] ❌ Failed to find an active global summarization provider for user ${pageConnection.user_id}`);
      return;
    }

    const provider = {
      id: globalProvider.id,
      userId: globalProvider.user_id,
      providerName: globalProvider.provider_name,
      displayName: globalProvider.display_name,
      baseUrl: globalProvider.base_url,
      apiKey: globalProvider.api_key,
      modelChat: globalProvider.model_chat,
      modelEmbedding: globalProvider.model_embedding,
      maxTokens: globalProvider.max_tokens,
      temperature: globalProvider.temperature,
      contextWindow: globalProvider.context_window,
      extraHeaders: {}
    };

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
