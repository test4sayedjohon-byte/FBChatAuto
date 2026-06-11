import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import crypto from 'crypto';
import { syncPendingBackups } from './src/utils/backup';
import type { Env } from './src/types';

// Read .dev.vars
const envFile = fs.readFileSync('.dev.vars', 'utf8');
const env = envFile.split('\n').reduce((acc: any, line) => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    acc[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
  }
  return acc;
}, {});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

async function runTest() {
  console.log('=== Backend Media Vault & Backup Integration Test ===\n');

  // 1. Get an active user/page_connection to get a real user_id
  const { data: pageConns, error: pcError } = await supabase
    .from('page_connections')
    .select('user_id')
    .limit(1);

  if (pcError || !pageConns || pageConns.length === 0) {
    console.error('❌ Failed to fetch a test user_id from page_connections:', pcError);
    process.exit(1);
  }

  const userId = pageConns[0].user_id;
  console.log(`✅ Found active user_id for test: ${userId}`);

  // 2. Upload a dummy text file to Supabase Storage
  console.log('\n--- Testing Storage Upload ---');
  const dummyContent = `Dummy test file generated at ${new Date().toISOString()} for fbchatauto Media Vault integration testing.`;
  const buffer = Buffer.from(dummyContent, 'utf-8');
  const fileName = `test_dummy_${Date.now()}.txt`;
  const filePath = `${userId}/media/${fileName}`;

  console.log(`Uploading dummy file to bucket 'media_assets' at: ${filePath}`);
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('media_assets')
    .upload(filePath, buffer, {
      contentType: 'text/plain',
      upsert: true
    });

  if (uploadError) {
    console.error('❌ Storage upload failed:', uploadError);
    process.exit(1);
  }
  console.log('✅ Storage upload to "media_assets" bucket succeeded:', uploadData);

  // 3. Insert metadata record in the database
  console.log('\n--- Testing Database Insert ---');
  const mediaId = crypto.randomUUID();
  const mockMedia = {
    id: mediaId,
    user_id: userId,
    name: `dummy_test_${Date.now()}`,
    friendly_name: `Dummy Test Asset ${Date.now()}`,
    description: 'A mock asset created by backend integration test',
    file_url: `${env.SUPABASE_URL}/storage/v1/object/public/media_assets/${filePath}`,
    file_type: 'image',
    times_sent: 0,
    use_in_chat: true,
    use_in_comments: true,
    use_in_scheduler: false,
    is_permanent: false,
    backup_status: 'pending'
  };

  const { data: insertData, error: insertError } = await supabase
    .from('media')
    .insert(mockMedia)
    .select();

  if (insertError) {
    console.error('❌ Database insert into table "media" failed:', insertError);
    process.exit(1);
  }
  console.log('✅ Database insert succeeded:', insertData[0]);

  // 4. Retrieve/Query by name/alias fallback logic check
  console.log('\n--- Testing Media Resolution ---');
  const { data: resolvedAsset, error: resolveError } = await supabase
    .from('media')
    .select('*')
    .eq('user_id', userId)
    .eq('name', mockMedia.name)
    .single();

  if (resolveError || !resolvedAsset) {
    console.error('❌ Failed to resolve media asset by name:', resolveError);
    process.exit(1);
  }
  console.log('✅ Media asset resolved successfully by name:', resolvedAsset);

  // 5. Test times_sent increment
  console.log('\n--- Testing times_sent Increment ---');
  const { data: updateData, error: updateError } = await supabase
    .from('media')
    .update({ times_sent: resolvedAsset.times_sent + 1 })
    .eq('id', resolvedAsset.id)
    .select();

  if (updateError || !updateData || updateData[0].times_sent !== 1) {
    console.error('❌ Failed to increment times_sent counter:', updateError);
    process.exit(1);
  }
  console.log('✅ Increment times_sent succeeded. New times_sent:', updateData[0].times_sent);

  // 5.5. Test Backup Sync Runner
  console.log('\n--- Testing Backup Sync Runner ---');
  
  let r2Uploaded = false;
  const mockR2 = {
    put: async (key: string, dataBuffer: ArrayBuffer, options: any) => {
      console.log(`[Mock R2] Uploaded key: ${key}`);
      r2Uploaded = true;
      return {};
    }
  } as any;
  
  const mockEnv = {
    MEDIA_BACKUP_BUCKET: mockR2,
    DB: null
  } as unknown as Env;

  const backupCount = await syncPendingBackups(supabase, mockEnv);
  if (backupCount === 0 || !r2Uploaded) {
    console.error('❌ Backup sync runner failed to back up mock asset.');
    process.exit(1);
  }
  
  // Verify status is updated to completed
  const { data: verifiedBackup } = await supabase
    .from('media')
    .select('backup_status, backup_urls')
    .eq('id', mediaId)
    .single();
    
  if (verifiedBackup?.backup_status !== 'completed' || !verifiedBackup?.backup_urls?.r2_url) {
    console.error('❌ Backup status or URLs not updated correctly in DB:', verifiedBackup);
    process.exit(1);
  }
  console.log('✅ Backup sync succeeded. Status:', verifiedBackup.backup_status, 'URLs:', verifiedBackup.backup_urls);

  // 6. Cleanup
  console.log('\n--- Cleaning Up Test Data ---');
  const { error: dbDeleteError } = await supabase
    .from('media')
    .delete()
    .eq('id', mediaId);

  if (dbDeleteError) {
    console.error('⚠️ Warning: failed to clean up db record:', dbDeleteError);
  } else {
    console.log('✅ Cleaned up database record');
  }

  const { error: storageDeleteError } = await supabase.storage
    .from('media_assets')
    .remove([filePath]);

  if (storageDeleteError) {
    console.error('⚠️ Warning: failed to clean up storage file:', storageDeleteError);
  } else {
    console.log('✅ Cleaned up storage file from "media_assets"');
  }

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Media Vault & Backup Pipeline are working properly.');
}

runTest().catch(err => {
  console.error('Unhandled execution error:', err);
  process.exit(1);
});
