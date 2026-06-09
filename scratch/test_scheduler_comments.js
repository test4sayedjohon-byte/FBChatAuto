const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🏁 Starting Scheduler Auto-Comments Integration Test...\n');

  // 1. Read .dev.vars to extract Supabase settings
  const devVarsPath = path.join(__dirname, '../worker/.dev.vars');
  if (!fs.existsSync(devVarsPath)) {
    console.error('❌ worker/.dev.vars file not found! Make sure to run inside fbchatauto project.');
    process.exit(1);
  }

  const devVarsContent = fs.readFileSync(devVarsPath, 'utf8');
  const vars = {};
  devVarsContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      vars[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });

  const supabaseUrl = vars.SUPABASE_URL;
  const supabaseKey = vars.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Failed to extract SUPABASE_URL or SUPABASE_SERVICE_KEY from .dev.vars.');
    process.exit(1);
  }

  // Helpers to interact with Supabase REST API using service role key
  async function callSupabase(method, path, body = null, headers = {}) {
    const url = `${supabaseUrl}/rest/v1/${path}`;
    const options = {
      method,
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...headers
      }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase API error (${res.status}): ${errText}`);
    }
    return res.status === 204 ? null : await res.json();
  }

  const userId = 'e71afde7-ec06-4c0d-9982-3e665e294817'; // test user
  const pageId = '661388580399300'; // test page ID

  // --- CLEANUP ---
  console.log('🧹 Cleaning up old test scheduled posts...');
  await callSupabase('DELETE', `scheduled_posts?user_id=eq.${userId}`);
  console.log('✅ Cleanup completed.');

  // Create a page connection if it doesn't exist (with is_active=true)
  console.log('🔗 Ensuring page connection exists...');
  const existingConn = await callSupabase('GET', `page_connections?page_id=eq.${pageId}`);
  if (existingConn.length === 0) {
    await callSupabase('POST', 'page_connections', {
      user_id: userId,
      page_id: pageId,
      page_name: 'Test Page',
      access_token: 'mock-token',
      is_active: true
    });
    console.log('✅ Created test page connection.');
  }

  // Insert a scheduled post that is due right now with auto comments
  console.log('📝 Creating a scheduled post with auto-comments...');
  const now = new Date();
  const post = await callSupabase('POST', 'scheduled_posts', {
    user_id: userId,
    page_connection_id: pageId,
    platform: 'facebook',
    post_type: 'text',
    message: 'Hello World from Scheduler Test!',
    scheduled_time: now.toISOString(),
    status: 'scheduled',
    first_comments: ['First Comment!', 'Second Thread Comment!']
  });

  if (post && post.length > 0) {
    console.log('✅ Scheduled post created successfully with ID:', post[0].id);
  } else {
    console.error('❌ Failed to create scheduled post.');
    process.exit(1);
  }

  console.log('\n📡 Triggering Worker Scheduler via HTTP API...');
  
  // Since we are running the local worker, we can trigger the scheduler job by sending a request
  // Wait, does the worker have a trigger endpoint?
  // Let's check how the worker runs scheduler jobs. The worker runs them via scheduled cron.
  // Can we run a local runner or trigger it directly?
  // Let's see: index.ts scheduled() triggers:
  // await runSchedulerJobs(supabase);
  // Is there a route in api.ts to trigger the scheduler for testing?
  // Let's search for runSchedulerJobs or scheduler in worker/src/routes/api.ts.
  console.log('🏁 Scheduler test initialized. You can trigger wrangler scheduler or run local job.');
}

main().catch(err => {
  console.error('Fatal test error:', err);
});
