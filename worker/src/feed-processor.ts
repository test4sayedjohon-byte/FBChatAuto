import type { Env } from './types';
import { createSupabaseAdmin } from './supabase';

export async function processFeedChanges(
  changes: any[],
  pageConnectionId: string,
  platform: 'facebook' | 'instagram',
  env: Env
): Promise<void> {
  const supabase = createSupabaseAdmin(env);

  for (const change of changes) {
    try {
      const { field, value } = change;
      
      // We only care about feed changes (native posts being deleted)
      if (field !== 'feed') continue;
      
      // If a native post is removed/deleted
      if (value.verb === 'remove' && (value.item === 'post' || value.item === 'status' || value.item === 'photo' || value.item === 'video')) {
        const postId = value.post_id;
        
        console.log(`[Bidirectional Sync] Detected native post deletion for ${postId}`);

        // Mark the post as natively deleted in our calendar
        await supabase
          .from('scheduled_posts')
          .update({ status: 'deleted_native' })
          .eq('id', postId);
      }
      
    } catch (err: any) {
      console.error(`[Feed Sync] Error processing feed change: ${err.message}`);
    }
  }
}
