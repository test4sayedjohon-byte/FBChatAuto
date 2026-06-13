import type { SupabaseClient } from '@supabase/supabase-js';

export interface ContentMemory {
  theme: string;
  summary: string;
  keywords: string[];
}

/**
 * Fetches the last 20 content memories for the user and compiles them into a token-efficient system instruction.
 */
export async function getRecentMemoryContext(supabase: SupabaseClient, userId: string): Promise<{
  memoryContext: string;
  recentThemes: string[];
}> {
  try {
    const { data, error } = await supabase
      .from('ai_content_memory')
      .select('theme, keywords')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      return { memoryContext: '', recentThemes: [] };
    }

    const recentThemes = data.map(m => m.theme);
    const allKeywords = Array.from(new Set(data.flatMap(m => m.keywords || []))).slice(0, 30);

    const memoryContext = `
DEDUPLICATION RULES (Strict constraints to avoid repeating recent posts):
- Do NOT cover these recent topics/themes: ${JSON.stringify(recentThemes)}.
- Avoid overusing these recent keywords: ${allKeywords.join(', ')}.
Focus on fresh concepts, alternative hooks, or different angles.
`;
    return { memoryContext, recentThemes };
  } catch (err) {
    console.error('[Content Memory] Failed to load memory context:', err);
    return { memoryContext: '', recentThemes: [] };
  }
}

/**
 * Saves a generated post's metadata to the content memory table.
 */
export async function saveContentMemory(
  supabase: SupabaseClient,
  userId: string,
  batchId: string,
  postId: string,
  memory: ContentMemory
): Promise<void> {
  try {
    const { error } = await supabase
      .from('ai_content_memory')
      .insert({
        user_id: userId,
        batch_id: batchId,
        post_id: postId,
        theme: memory.theme || 'General content',
        summary: memory.summary || '',
        keywords: memory.keywords || []
      });

    if (error) {
      console.error('[Content Memory] Error inserting memory record:', error.message);
    }
  } catch (err) {
    console.error('[Content Memory] Exception inserting memory record:', err);
  }
}
