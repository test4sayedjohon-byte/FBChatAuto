// ============================================================================
// Cron Scheduled Post Publisher & Token Health Monitor
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { publishToFacebook, publishToInstagram } from './media-uploader';

export async function runSchedulerJobs(supabase: SupabaseClient): Promise<void> {
  const now = new Date().toISOString();

  // 1. Fetch scheduled posts that are due or need a retry
  const { data: posts, error: fetchErr } = await supabase
    .from('scheduled_posts')
    .select('*, page_connection:page_connections(*)')
    .in('status', ['scheduled', 'uploading', 'failed'])
    .lt('retry_count', 3)
    .lte('scheduled_time', now);

  if (fetchErr || !posts || posts.length === 0) {
    if (fetchErr) console.error('[Scheduler] Error fetching scheduled posts:', fetchErr.message);
    return;
  }

  console.log(`[Scheduler] Found ${posts.length} posts due for publication.`);

  for (const post of posts) {
    const pageConnection = post.page_connection;
    if (!pageConnection || !pageConnection.access_token) {
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'failed',
          error_message: 'Page connection or access token missing.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id);
      continue;
    }

    // Mark as uploading to lock the row
    await supabase
      .from('scheduled_posts')
      .update({ status: 'uploading', updated_at: new Date().toISOString() })
      .eq('id', post.id);

    try {
      let postId = '';
      if (post.platform === 'facebook') {
        const fbRes = await publishToFacebook(
          pageConnection.access_token,
          pageConnection.page_id,
          post.message || '',
          post.media_urls || []
        );
        postId = fbRes.postId;
      } else {
        // Instagram
        const igUserId = (pageConnection as any).instagram_account_id || pageConnection.page_id;
        const mediaUrl = post.media_urls?.[0];
        if (!mediaUrl) {
          throw new Error('Instagram requires at least one media URL attachment.');
        }
        const isVideo = mediaUrl.toLowerCase().match(/\.(mp4|mov|avi|mkv)$/) !== null;

        const igRes = await publishToInstagram(
          pageConnection.access_token,
          igUserId,
          post.message || '',
          mediaUrl,
          isVideo
        );
        postId = igRes.postId;
      }

      // Mark published successfully
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'published',
          meta_post_id: postId,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id);

      console.log(`[Scheduler] Post ${post.id} successfully published to ${post.platform}.`);

      // Publish Auto-Comments/First-Comments if defined
      if (post.first_comments && Array.isArray(post.first_comments) && post.first_comments.length > 0) {
        console.log(`[Scheduler] Publishing ${post.first_comments.length} automated comments under post ${postId}...`);
        for (let i = 0; i < post.first_comments.length; i++) {
          const commentText = post.first_comments[i];
          try {
            await publishComment(pageConnection.access_token, postId, commentText);
            console.log(`[Scheduler] Published comment ${i + 1}/${post.first_comments.length} under post ${postId}`);
            // Tiny delay between comments to ensure chronological order
            if (i < post.first_comments.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (commErr: any) {
            console.error(`[Scheduler] Failed to publish auto-comment ${i + 1} for post ${post.id}:`, commErr.message);
          }
        }
      }
    } catch (err: any) {
      console.error(`[Scheduler] Publishing failed for post ${post.id}:`, err.message);

      const nextRetryCount = (post.retry_count || 0) + 1;
      const nextStatus = nextRetryCount >= 3 ? 'failed' : 'scheduled';

      await supabase
        .from('scheduled_posts')
        .update({
          status: nextStatus,
          retry_count: nextRetryCount,
          error_message: err.message || 'Unknown Meta API failure.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id);
    }
  }
}

export async function runTokenHealthChecks(supabase: SupabaseClient): Promise<void> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Fetch connections that haven't been checked in 24 hours
  const { data: connections, error } = await supabase
    .from('page_connections')
    .select('id, page_id, access_token')
    .or(`token_last_checked_at.lte.${oneDayAgo},token_last_checked_at.is.null`)
    .limit(10);

  if (error || !connections || connections.length === 0) return;

  console.log(`[Health Cron] Checking validity of ${connections.length} Page access tokens.`);

  for (const conn of connections) {
    let tokenStatus = 'active';
    try {
      const testUrl = `https://graph.facebook.com/v25.0/me?access_token=${conn.access_token}`;
      const res = await fetch(testUrl, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        tokenStatus = 'expired';
      }
    } catch (err) {
      tokenStatus = 'expired';
    }

    await supabase
      .from('page_connections')
      .update({
        token_status: tokenStatus,
        token_last_checked_at: new Date().toISOString(),
      })
      .eq('id', conn.id);

    if (tokenStatus === 'expired') {
      console.warn(`[Health Cron] ⚠️ Access token for connection ${conn.page_id} has EXPIRED.`);
      // Optional: Add notification row to notify user in dashboard
    }
  }
}

async function publishComment(accessToken: string, parentId: string, message: string): Promise<string> {
  const url = `https://graph.facebook.com/v25.0/${parentId}/comments`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ message })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Meta API comment failure (${res.status}): ${errText}`);
  }

  const data: any = await res.json();
  return data.id;
}
