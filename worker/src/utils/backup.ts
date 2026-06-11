import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../types';

/**
 * Sign a JWT using RS256 (Web Crypto SubtleCrypto) for Google API Auth.
 */
async function signJwt(privateKeyPem: string, payload: any): Promise<string> {
  const cleanPem = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(cleanPem), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  );
  
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const tokenInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(tokenInput)
  );
  
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
  return `${tokenInput}.${encodedSignature}`;
}

/**
 * Exchange Service Account JWT assertion for Google Drive access token.
 */
async function getGoogleDriveAccessToken(serviceAccountJson: string): Promise<string> {
  try {
    const creds = JSON.parse(serviceAccountJson);
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
      iss: creds.client_email,
      scope: 'https://www.googleapis.com/auth/drive.file',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };
    
    const assertion = await signJwt(creds.private_key, payload);
    
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`
    });
    
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Google OAuth request failed: ${tokenRes.status} - ${errText}`);
    }
    
    const tokenData = await tokenRes.json() as { access_token: string };
    return tokenData.access_token;
  } catch (err: any) {
    throw new Error(`Failed to generate Google access token: ${err.message}`);
  }
}

/**
 * Upload an file buffer to Google Drive via multipart REST API.
 */
async function uploadToGoogleDrive(
  accessToken: string,
  fileBuffer: ArrayBuffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const metadata = {
    name: fileName,
    mimeType: contentType
  };
  
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([fileBuffer], { type: contentType }));
  
  const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: form
  });
  
  if (!driveRes.ok) {
    const errText = await driveRes.text();
    throw new Error(`Google Drive upload failed: ${driveRes.status} - ${errText}`);
  }
  
  const driveData = await driveRes.json() as { id: string };
  return driveData.id;
}

/**
 * Coordinator to download pending media assets and back them up to Cloudflare R2 and Google Drive.
 */
export async function syncPendingBackups(supabase: SupabaseClient, env: Env): Promise<number> {
  console.log('[Backup Sync] Scanning for pending backups...');
  
  // 1. Fetch pending backups from Supabase
  const { data: pendingMedia, error: queryErr } = await supabase
    .from('media')
    .select('*')
    .eq('backup_status', 'pending')
    .limit(10);
    
  if (queryErr) {
    console.error('[Backup Sync] Failed to query pending media records:', queryErr.message);
    return 0;
  }
  
  if (!pendingMedia || pendingMedia.length === 0) {
    return 0;
  }
  
  console.log(`[Backup Sync] Found ${pendingMedia.length} pending media files to back up.`);
  let successCount = 0;
  
  // Resolve Google Drive credentials if present in env (e.g. as GOOGLE_SERVICE_ACCOUNT_JSON)
  let googleAccessToken: string | null = null;
  const gServiceAccountJson = (env as any).GOOGLE_SERVICE_ACCOUNT_JSON || null;
  if (gServiceAccountJson) {
    try {
      googleAccessToken = await getGoogleDriveAccessToken(gServiceAccountJson);
      console.log('[Backup Sync] Successfully authenticated with Google Service Account');
    } catch (gAuthErr: any) {
      console.error('[Backup Sync] Google Drive authentication failed:', gAuthErr.message);
    }
  } else {
    console.log('[Backup Sync] No GOOGLE_SERVICE_ACCOUNT_JSON env secret found. Google Drive backup skipped.');
  }

  for (const media of pendingMedia) {
    try {
      if (!media.file_url) {
        throw new Error('Media asset has no file_url');
      }
      
      // 2. Fetch/Download the file binary
      console.log(`[Backup Sync] Downloading original file: ${media.file_url}`);
      const downloadRes = await fetch(media.file_url);
      if (!downloadRes.ok) {
        throw new Error(`Failed to download original file: ${downloadRes.status}`);
      }
      const fileBuffer = await downloadRes.arrayBuffer();
      const contentType = downloadRes.headers.get('Content-Type') || media.file_type || 'application/octet-stream';
      
      // Extract file name or generate one
      const urlPath = new URL(media.file_url).pathname;
      const fileName = urlPath.split('/').pop() || `${media.id}_file`;
      
      // 3. Upload to Cloudflare R2 (if binding is configured)
      let r2Url: string | null = null;
      if (env.MEDIA_BACKUP_BUCKET) {
        const r2Key = `${media.user_id}/${media.id}_${fileName}`;
        console.log(`[Backup Sync] Uploading to Cloudflare R2: ${r2Key}`);
        await env.MEDIA_BACKUP_BUCKET.put(r2Key, fileBuffer, {
          customMetadata: {
            userId: media.user_id,
            mediaId: media.id,
            originalName: fileName
          },
          httpMetadata: {
            contentType: contentType
          }
        });
        // Construct worker backup retrieval URL
        r2Url = `/api/media/backup/${r2Key}`;
      } else {
        console.warn('[Backup Sync] Cloudflare R2 binding MEDIA_BACKUP_BUCKET is not configured.');
      }
      
      // 4. Upload to Google Drive (if token obtained)
      let googleDriveId: string | null = null;
      if (googleAccessToken) {
        console.log(`[Backup Sync] Uploading to Google Drive: ${fileName}`);
        googleDriveId = await uploadToGoogleDrive(googleAccessToken, fileBuffer, fileName, contentType);
      }
      
      // 5. Update Database Record
      const backupUrls = {
        r2_url: r2Url,
        google_drive_id: googleDriveId
      };
      
      const { error: updateErr } = await supabase
        .from('media')
        .update({
          backup_status: 'completed',
          backup_urls: backupUrls,
          updated_at: new Date().toISOString()
        })
        .eq('id', media.id);
        
      if (updateErr) {
        throw updateErr;
      }
      
      // Also update local D1 replica if local DB is provided
      if (env.DB) {
        await env.DB.prepare(
          `UPDATE media SET backup_status = 'completed', backup_urls = ?, updated_at = ? WHERE id = ?`
        )
          .bind(JSON.stringify(backupUrls), new Date().toISOString(), media.id)
          .run();
      }
      
      console.log(`[Backup Sync] Successfully backed up media ${media.id}`);
      successCount++;
    } catch (err: any) {
      console.error(`[Backup Sync] Failed to back up media ${media.id}:`, err.message);
      
      // Mark as failed in Supabase so it does not block the sync queue endlessly
      await supabase
        .from('media')
        .update({ backup_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', media.id);
        
      if (env.DB) {
        await env.DB.prepare(
          `UPDATE media SET backup_status = 'failed', updated_at = ? WHERE id = ?`
        )
          .bind(new Date().toISOString(), media.id)
          .run();
      }
    }
  }
  
  return successCount;
}
