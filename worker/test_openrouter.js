const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.dev.vars', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    acc[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
  }
  return acc;
}, {});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: provider, error: pErr } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('is_active_chat', true)
    .maybeSingle();

  if (pErr || !provider) {
    console.error('No active chat provider:', pErr);
    return;
  }

  console.log(`Testing Active Provider: ${provider.display_name}`);
  console.log(`URL: ${provider.base_url}`);
  console.log(`Model: ${provider.model_chat}`);

  try {
    const response = await fetch(`${provider.base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.api_key}`,
        'HTTP-Referer': 'https://autometabot.com',
        'X-Title': 'AutometaBot'
      },
      body: JSON.stringify({
        model: provider.model_chat,
        messages: [{ role: 'user', content: 'Say hello!' }],
        max_tokens: 10
      })
    });

    console.log(`HTTP Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log('Response content:', text);
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}
run();
