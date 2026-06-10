const crypto = require('crypto');

async function test() {
  const userId = '8edf1810-b3f4-40b8-a554-2325dbe55fd8';
  const pageId = '452281641312964';
  const secret = 'b7ab0b50e5704e00c69cbd95f726e3e4'; 

  // Node ID of the interactive node from the DB
  const nodeId = '0c22f4bb-d61f-4b1b-b415-d16557eaef67';
  
  // Tapping 'pf' (Phone Farming Box) which connects to the next interactive node
  const payload = `FLOW_NODE_ID:${nodeId}:pf`;

  const webhookPayload = {
    object: 'page',
    entry: [{
      id: pageId,
      time: Date.now(),
      messaging: [{
        sender: { id: '27130268496625212' }, // Must match the active session sender ID
        recipient: { id: pageId },
        timestamp: Date.now(),
        postback: {
          title: 'ফোন ফার্মিং বক্স',
          payload: payload
        }
      }]
    }]
  };

  const body = JSON.stringify(webhookPayload);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  const signature = 'sha256=' + hmac.digest('hex');

  try {
    const res = await fetch(`https://metachat.junoverseai.com/webhook/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature
      },
      body
    });

    console.log(`Response Status: ${res.status} ${res.statusText}`);
    const json = await res.json();
    console.log('Response JSON:', json);
  } catch (err) {
    console.error('Error running test:', err);
  }
}

test();
