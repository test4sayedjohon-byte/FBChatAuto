const fs = require('fs');
const path = require('path');

async function runTests() {
  const keysPath = path.join(__dirname, '../test_keys.json');
  if (!fs.existsSync(keysPath)) {
    console.error('❌ test_keys.json file not found! Please create it in the workspace root.');
    return;
  }

  const keys = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
  console.log('🔑 Loaded test_keys.json successfully.');

  const tests = [
    {
      name: 'NVIDIA NIM',
      url: 'https://integrate.api.nvidia.com/v1/chat/completions',
      key: keys.NVIDIA_API_KEY,
      model: 'meta/llama-3.3-70b-instruct',
      placeholder: 'YOUR_NVIDIA_API_KEY_HERE'
    },
    {
      name: 'xAI Grok',
      url: 'https://api.x.ai/v1/chat/completions',
      key: keys.GROK_API_KEY,
      model: 'grok-2-1212',
      placeholder: 'YOUR_GROK_API_KEY_HERE'
    },
    {
      name: 'OpenRouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: keys.OPENROUTER_API_KEY,
      model: 'openai/gpt-4o-mini',
      placeholder: 'YOUR_OPENROUTER_API_KEY_HERE'
    }
  ];

  for (const t of tests) {
    console.log(`\n--- Testing ${t.name} ---`);
    if (!t.key || t.key === t.placeholder) {
      console.log(`⚠️ Skipped: No key provided for ${t.name}`);
      continue;
    }

    console.log(`Calling endpoint: ${t.url}`);
    console.log(`Using model: ${t.model}`);
    try {
      const response = await fetch(t.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${t.key}`
        },
        body: JSON.stringify({
          model: t.model,
          messages: [{ role: 'user', content: 'Say hello!' }],
          max_tokens: 10
        })
      });

      console.log(`HTTP Status: ${response.status} ${response.statusText}`);
      const text = await response.text();
      if (response.ok) {
        try {
          const json = JSON.parse(text);
          console.log(`✅ Success! Response: "${json.choices?.[0]?.message?.content?.trim()}"`);
        } catch {
          console.log(`✅ Success (raw text): ${text}`);
        }
      } else {
        console.error(`❌ Error response from ${t.name}: ${text}`);
      }
    } catch (err) {
      console.error(`❌ Connection failed for ${t.name}:`, err.message || err);
    }
  }
}

runTests();
