const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🧹 Cleaning up test data from Content Copilot integration test...');

  const devVarsPath = path.join(__dirname, '../worker/.dev.vars');
  if (!fs.existsSync(devVarsPath)) {
    console.error('❌ worker/.dev.vars file not found!');
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

  async function callSupabase(method, endpoint, body = null) {
    const url = `${supabaseUrl}/rest/v1/${endpoint}`;
    const options = {
      method,
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text();
      console.error(`Error deleting: ${text}`);
    }
  }

  // Delete test posts
  await callSupabase('DELETE', 'scheduled_posts?message=eq.Checking%20out%20the%20new%20Content%20Copilot%20agent!');
  
  // Delete test rules (keywords contains scam/fraud)
  await callSupabase('DELETE', 'comment_rules?keywords=cs.%7B"scam","fraud"%7D');

  console.log('✅ Cleanup completed successfully.');
}

main().catch(console.error);
