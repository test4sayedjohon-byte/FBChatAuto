const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bbfqyskkwustlrbxqajz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZnF5c2trd3VzdGxyYnhxYWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NzU2NywiZXhwIjoyMDk2MjUzNTY3fQ.Uf4xEEAifRgGe4GZRD77AotswAc6_uHsLMVOzwFhTyE');

async function testSendMessage(version, phoneNumberId, accessToken, recipient) {
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'text',
    text: {
      preview_url: false,
      body: `Test message from API version ${version}`
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });
    const body = await res.text();
    console.log(`[${version}] Status: ${res.status}`);
    console.log(`[${version}] Response:`, body);
    return res.status === 200;
  } catch (err) {
    console.error(`[${version}] Error:`, err);
    return false;
  }
}

async function testTypingIndicator(version, phoneNumberId, accessToken, messageId) {
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
    typing_indicator: {
      type: 'text'
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });
    const body = await res.text();
    console.log(`[Typing Indicator ${version}] Status: ${res.status}`);
    console.log(`[Typing Indicator ${version}] Response:`, body);
    return res.status === 200;
  } catch (err) {
    console.error(`[Typing Indicator ${version}] Error:`, err);
    return false;
  }
}

async function run() {
  const { data: conn } = await supabase
    .from('page_connections')
    .select('*')
    .eq('whatsapp_phone_number_id', '1104393882765374')
    .single();

  if (!conn) {
    console.error("No WhatsApp connection found!");
    return;
  }

  const { access_token: accessToken, whatsapp_phone_number_id: phoneNumberId } = conn;
  const testRecipient = "8801712072408"; // User's phone number
  const testMessageId = "wamid.HBgNODgwMTcxMjA3MjQwOBUCABEYEjVGMTFFNDRERUYzNzcxNjFCNgA="; // from scratch run

  console.log(`Testing messaging for v21.0 vs v22.0...`);
  await testSendMessage('v21.0', phoneNumberId, accessToken, testRecipient);
  await testSendMessage('v22.0', phoneNumberId, accessToken, testRecipient);

  console.log(`Testing typing indicator for v21.0 vs v22.0...`);
  await testTypingIndicator('v21.0', phoneNumberId, accessToken, testMessageId);
  await testTypingIndicator('v22.0', phoneNumberId, accessToken, testMessageId);
}

run();
