const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🏁 Starting Social Media Automation & AI Moderation Integration Tests...\n');

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

  console.log(`📡 Connected to Supabase Project: ${supabaseUrl}`);

  // Helpers to interact with Supabase REST API using service role key (bypasses RLS)
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
  console.log('🧹 Cleaning up old test data...');
  await callSupabase('DELETE', `comment_rules?user_id=eq.${userId}`);
  await callSupabase('DELETE', `comment_logs?user_id=eq.${userId}`);
  await callSupabase('DELETE', `user_blocklist?user_id=eq.${userId}`);
  console.log('✅ Cleanup completed.');

  // Initialize credits for user to ensure limit checks pass
  console.log('💳 Resetting user credits for testing...');
  await callSupabase('PATCH', `users?id=eq.${userId}`, {
    credits_used_this_month: 0,
    monthly_credits_limit: 1000,
    daily_credit_spend_cap: 200
  });

  // Helper to wait
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // ==========================================
  // TEST 1: NLP Autopilot Config
  // ==========================================
  console.log('\n--- TEST 1: NLP Autopilot Configuration Drawer ---');
  try {
    const autopilotRes = await fetch('http://localhost:8787/api/autopilot-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bypass-Auth': 'true'
      },
      body: JSON.stringify({
        userId,
        message: "When someone comments 'discount', send DM 'Here is your 20% discount code: FB20'."
      })
    });

    if (!autopilotRes.ok) {
      throw new Error(`Worker returned HTTP ${autopilotRes.status}: ${await autopilotRes.text()}`);
    }

    const autopilotResult = await autopilotRes.json();
    console.log('🤖 Autopilot Reply:', autopilotResult.reply);
    console.log('🔄 Data Modified:', autopilotResult.dataModified);

    // Verify in DB
    const rules = await callSupabase('GET', `comment_rules?user_id=eq.${userId}&trigger_type=eq.keywords`);
    const discountRule = rules.find(r => r.keywords && r.keywords.includes('discount'));
    if (discountRule) {
      console.log('✅ Success: Autopilot rule created in DB:', discountRule.id);
    } else {
      console.error('❌ Failed: Autopilot rule not found in DB.');
    }
  } catch (err) {
    console.error('❌ TEST 1 FAILED:', err.message);
  }

  // ==========================================
  // TEST 2: Comment Webhook Ingestion (Keyword -> DM)
  // ==========================================
  console.log('\n--- TEST 2: Comment Webhook Ingestion (Keyword -> DM) ---');
  try {
    const webhookPayload = {
      object: 'page',
      entry: [{
        id: pageId,
        time: Date.now(),
        changes: [{
          field: 'feed',
          value: {
            item: 'comment',
            verb: 'add',
            comment_id: 'comment_fb_1',
            post_id: 'post_fb_1',
            sender_id: 'test_user_fb_1',
            sender_name: 'Test User 1',
            message: 'Can I get a discount?'
          }
        }]
      }]
    };

    const webhookRes = await fetch(`http://localhost:8787/webhook/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });

    console.log(`Webhook HTTP Status: ${webhookRes.status} ${webhookRes.statusText}`);

    // Wait for async processing
    console.log('⏳ Waiting for background worker comments coordinator (3s)...');
    await sleep(3000);

    // Check logs
    const logs = await callSupabase('GET', `comment_logs?comment_id=eq.comment_fb_1`);
    if (logs && logs.length > 0) {
      const log = logs[0];
      console.log('✅ Success: Comment processed and logged.');
      console.log('👉 Action Taken:', log.action_taken);
      console.log('👉 Credits Deducted:', log.credits_deducted);
      if (log.action_taken === 'dm_sent' && log.credits_deducted === 1) {
        console.log('🎉 Verified correct actions and credits!');
      } else {
        console.error('❌ Incorrect actions/credits logged.');
      }
    } else {
      console.error('❌ Failed: No log entry found for comment_fb_1.');
    }
  } catch (err) {
    console.error('❌ TEST 2 FAILED:', err.message);
  }

  // ==========================================
  // TEST 3: Duplicate Comment Webhook Protection
  // ==========================================
  console.log('\n--- TEST 3: Duplicate Comment Webhook Protection ---');
  try {
    // Re-send same comment ID
    const webhookPayload = {
      object: 'page',
      entry: [{
        id: pageId,
        time: Date.now(),
        changes: [{
          field: 'feed',
          value: {
            item: 'comment',
            verb: 'add',
            comment_id: 'comment_fb_1',
            post_id: 'post_fb_1',
            sender_id: 'test_user_fb_1',
            sender_name: 'Test User 1',
            message: 'Can I get a discount?'
          }
        }]
      }]
    };

    // Before count
    const initialUserRecord = await callSupabase('GET', `users?id=eq.${userId}`);
    const initialCredits = initialUserRecord[0].credits_used_this_month;

    const webhookRes = await fetch(`http://localhost:8787/webhook/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });

    console.log('⏳ Waiting for processing (1.5s)...');
    await sleep(1500);

    const finalUserRecord = await callSupabase('GET', `users?id=eq.${userId}`);
    const finalCredits = finalUserRecord[0].credits_used_this_month;

    if (initialCredits === finalCredits) {
      console.log('✅ Success: Duplicate comment did not consume extra credits.');
    } else {
      console.error(`❌ Failed: Credits increased from ${initialCredits} to ${finalCredits}!`);
    }
  } catch (err) {
    console.error('❌ TEST 3 FAILED:', err.message);
  }

  // ==========================================
  // TEST 4: Keyword Stop / Opt-out Blocklist Handling
  // ==========================================
  console.log('\n--- TEST 4: Keyword Stop / Opt-out Blocklist ---');
  try {
    const webhookPayload = {
      object: 'page',
      entry: [{
        id: pageId,
        time: Date.now(),
        changes: [{
          field: 'feed',
          value: {
            item: 'comment',
            verb: 'add',
            comment_id: 'comment_fb_stop',
            post_id: 'post_fb_1',
            sender_id: 'test_user_fb_1',
            sender_name: 'Test User 1',
            message: 'STOP'
          }
        }]
      }]
    };

    await fetch(`http://localhost:8787/webhook/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });

    console.log('⏳ Waiting for blocklist storage (2s)...');
    await sleep(2000);

    const blocklist = await callSupabase('GET', `user_blocklist?user_id=eq.${userId}&sender_id=eq.test_user_fb_1`);
    if (blocklist && blocklist.length > 0) {
      console.log('✅ Success: User test_user_fb_1 added to blocklist.');
    } else {
      console.error('❌ Failed: User was not added to the blocklist.');
    }
  } catch (err) {
    console.error('❌ TEST 4 FAILED:', err.message);
  }

  // ==========================================
  // TEST 5: Blocklist Safeguard Verification
  // ==========================================
  console.log('\n--- TEST 5: Blocklist Safeguard Verification ---');
  try {
    // Blocked user sends another comment
    const webhookPayload = {
      object: 'page',
      entry: [{
        id: pageId,
        time: Date.now(),
        changes: [{
          field: 'feed',
          value: {
            item: 'comment',
            verb: 'add',
            comment_id: 'comment_fb_after_block',
            post_id: 'post_fb_1',
            sender_id: 'test_user_fb_1',
            sender_name: 'Test User 1',
            message: 'Can I get a discount?'
          }
        }]
      }]
    };

    await fetch(`http://localhost:8787/webhook/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });

    console.log('⏳ Waiting (2s)...');
    await sleep(2000);

    const logs = await callSupabase('GET', `comment_logs?comment_id=eq.comment_fb_after_block`);
    if (logs.length === 0) {
      console.log('✅ Success: Blocklisted user comment was ignored.');
    } else {
      console.error('❌ Failed: Blocklisted user comment was processed! Log ID:', logs[0].id);
    }
  } catch (err) {
    console.error('❌ TEST 5 FAILED:', err.message);
  }

  // ==========================================
  // TEST 6: AI Sentiment auto-moderation rules & Trash Queue
  // ==========================================
  console.log('\n--- TEST 6: AI Sentiment auto-moderation & Trash Queue ---');
  try {
    // 1. Manually insert an AI sentiment rule for negative sentiment
    console.log('🔧 Creating AI sentiment auto-moderation rule in DB...');
    await callSupabase('POST', 'comment_rules', {
      user_id: userId,
      page_connection_id: pageId,
      trigger_type: 'ai_sentiment',
      sentiment_target: 'negative',
      action_to_take: 'trash_queue',
      is_active: true
    });

    // Send angry negative comment
    const webhookPayload = {
      object: 'page',
      entry: [{
        id: pageId,
        time: Date.now(),
        changes: [{
          field: 'feed',
          value: {
            item: 'comment',
            verb: 'add',
            comment_id: 'comment_fb_angry',
            post_id: 'post_fb_1',
            sender_id: 'test_user_fb_angry',
            sender_name: 'Angry Customer',
            message: 'This is the absolute worst app I have ever used, terrible support.'
          }
        }]
      }]
    };

    await fetch(`http://localhost:8787/webhook/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });

    console.log('⏳ Waiting for AI processing and classification (6s)...');
    await sleep(6000);

    const logs = await callSupabase('GET', `comment_logs?comment_id=eq.comment_fb_angry`);
    if (logs && logs.length > 0) {
      const log = logs[0];
      console.log('✅ Success: AI auto-moderation log created.');
      console.log('👉 Detected Sentiment:', log.ai_sentiment);
      console.log('👉 Toxicity Score:', log.ai_toxicity_score);
      console.log('👉 Action Taken:', log.action_taken);
      if (log.action_taken === 'trashed') {
        console.log('🎉 Verified correct sentiment routing to Trash Queue!');
      } else {
        console.error('❌ Action is not "trashed" (actual:', log.action_taken, ')');
      }
    } else {
      console.error('❌ Failed: No log entry found for comment_fb_angry.');
    }
  } catch (err) {
    console.error('❌ TEST 6 FAILED:', err.message);
  }

  // ==========================================
  // TEST 7: Inbound Vision Credit Costs
  // ==========================================
  console.log('\n--- TEST 7: Inbound Vision Credit Costs ---');
  try {
    const webhookPayload = {
      object: 'page',
      entry: [{
        id: pageId,
        time: Date.now(),
        changes: [{
          field: 'feed',
          value: {
            item: 'comment',
            verb: 'add',
            comment_id: 'comment_fb_vision',
            post_id: 'post_fb_1',
            sender_id: 'test_user_fb_vision',
            sender_name: 'Vision User',
            message: 'Here is my issue',
            photo: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809'
          }
        }]
      }]
    };

    await fetch(`http://localhost:8787/webhook/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });

    console.log('⏳ Waiting for photo webhook ingestion (8s)...');
    await sleep(8000);

    const logs = await callSupabase('GET', `comment_logs?comment_id=eq.comment_fb_vision`);
    if (logs && logs.length > 0) {
      const log = logs[0];
      console.log('✅ Success: Vision comment log created.');
      console.log('👉 Action Taken:', log.action_taken);
      console.log('👉 Credits Deducted:', log.credits_deducted);
      if (log.credits_deducted === 3) {
        console.log('🎉 Verified vision rate deduction (3 credits)!');
      } else {
        console.error('❌ Incorrect credits deducted (expected 3, got', log.credits_deducted, ')');
      }
    } else {
      console.error('❌ Failed: No log entry found for comment_fb_vision.');
    }
  } catch (err) {
    console.error('❌ TEST 7 FAILED:', err.message);
  }

  console.log('\n🏁 All test runs completed.');
}

main().catch(err => {
  console.error('Fatal test execution error:', err);
});
