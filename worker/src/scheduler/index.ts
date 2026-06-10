// ============================================================================
// Cron Scheduled Post Publisher & Token Health Monitor
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { publishToFacebook, publishToInstagram } from './media-uploader';

function getStoragePathFromUrl(url: string): string | null {
  const marker = '/media_assets/';
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const pathWithQuery = url.substring(index + marker.length);
  const path = pathWithQuery.split('?')[0];
  return decodeURIComponent(path);
}

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
        const isVideo = mediaUrl.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/) !== null;

        const igRes = await publishToInstagram(
          pageConnection.access_token,
          igUserId,
          post.message || '',
          mediaUrl,
          isVideo
        );
        postId = igRes.postId;
      }

      // Extract storage paths to delete and convert media URLs to local references
      const mediaUrls = post.media_urls || [];
      const updatedMediaUrls: string[] = [];
      const pathsToDelete: string[] = [];

      for (const url of mediaUrls) {
        let localName = 'unknown_file';
        try {
          const parsedUrl = new URL(url);
          const localNameParam = parsedUrl.searchParams.get('local_name');
          if (localNameParam) {
            localName = localNameParam;
          } else {
            const parts = parsedUrl.pathname.split('/');
            localName = parts[parts.length - 1];
          }
        } catch (e) {
          updatedMediaUrls.push(url);
          continue;
        }

        const storagePath = getStoragePathFromUrl(url);
        if (storagePath && url.includes('.supabase.')) {
          pathsToDelete.push(storagePath);
          updatedMediaUrls.push(`file://localhost/${localName}`);
        } else {
          updatedMediaUrls.push(url);
        }
      }

      if (pathsToDelete.length > 0) {
        console.log(`[Scheduler] Deleting ${pathsToDelete.length} published files from Supabase Storage:`, pathsToDelete);
        try {
          const { error: deleteErr } = await supabase.storage
            .from('media_assets')
            .remove(pathsToDelete);
          if (deleteErr) {
            console.error('[Scheduler] Failed to delete files from Supabase Storage:', deleteErr.message);
          } else {
            console.log('[Scheduler] Successfully deleted published files from Supabase Storage.');
          }
        } catch (storageErr: any) {
          console.error('[Scheduler] Storage deletion error:', storageErr.message);
        }
      }

      // Mark published successfully and replace URLs with local references
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'published',
          meta_post_id: postId,
          media_urls: updatedMediaUrls.length > 0 ? updatedMediaUrls : null,
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

export async function cleanupOrphanedStorageAssets(supabase: SupabaseClient): Promise<void> {
  try {
    const supabaseUrl = (supabase as any).supabaseUrl;
    const supabaseKey = (supabase as any).supabaseKey;
    if (!supabaseUrl || !supabaseKey) return;

    // Create a client focused on the storage schema
    const storageDbClient = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'storage' }
    });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Fetch files in 'media_assets' bucket older than 7 days
    const { data: objects, error: objErr } = await storageDbClient
      .from('objects')
      .select('name, created_at')
      .eq('bucket_id', 'media_assets')
      .lt('created_at', sevenDaysAgo)
      .limit(100); // Process in batches of 100

    if (objErr || !objects || objects.length === 0) {
      if (objErr) console.error('[Storage Cleanup] Failed to fetch storage objects:', objErr.message);
      return;
    }

    console.log(`[Storage Cleanup] Auditing ${objects.length} assets older than 7 days for orphans...`);

    // 2. Fetch all active references from DB
    const { data: chatAssets } = await supabase.from('chat_assets').select('file_url');
    const { data: posts } = await supabase.from('scheduled_posts').select('media_urls').not('media_urls', 'is', null);
    const { data: rules } = await supabase.from('comment_rules').select('attachment_urls, dm_attachment_urls');

    // Extract all referenced URLs
    const activeUrls = new Set<string>();
    if (chatAssets) {
      chatAssets.forEach(a => { if (a.file_url) activeUrls.add(a.file_url); });
    }
    if (posts) {
      posts.forEach(p => {
        if (p.media_urls && Array.isArray(p.media_urls)) {
          p.media_urls.forEach(url => activeUrls.add(url));
        }
      });
    }
    if (rules) {
      rules.forEach(r => {
        if (r.attachment_urls && Array.isArray(r.attachment_urls)) {
          r.attachment_urls.forEach((url: string) => activeUrls.add(url));
        }
        if (r.dm_attachment_urls && Array.isArray(r.dm_attachment_urls)) {
          r.dm_attachment_urls.forEach((url: string) => activeUrls.add(url));
        }
      });
    }

    // 3. Identify and delete orphans
    const pathsToDelete: string[] = [];
    for (const obj of objects) {
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/media_assets/${obj.name}`;
      if (!activeUrls.has(publicUrl)) {
        pathsToDelete.push(obj.name);
      }
    }

    if (pathsToDelete.length > 0) {
      console.log(`[Storage Cleanup] Deleting ${pathsToDelete.length} orphaned storage files:`, pathsToDelete);
      const { error: removeErr } = await supabase.storage
        .from('media_assets')
        .remove(pathsToDelete);
      
      if (removeErr) {
        console.error('[Storage Cleanup] Error removing files from bucket:', removeErr.message);
      } else {
        console.log('[Storage Cleanup] Successfully purged orphaned files.');
      }
    } else {
      console.log('[Storage Cleanup] No orphaned files found to purge.');
    }
  } catch (err: any) {
    console.error('[Storage Cleanup] Error running sweeper:', err.message);
  }
}
