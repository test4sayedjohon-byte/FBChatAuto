const crypto = require('crypto');

async function test() {
  const userId = '8edf1810-b3f4-40b8-a554-2325dbe55fd8';
  const pageId = '452281641312964';
  const postId = '452281641312964_122183681654629798';
  const secret = 'b7ab0b50e5704e00c69cbd95f726e3e4'; // super_admin fallback secret from DB

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
          comment_id: `comment_test_${Date.now()}`,
          post_id: postId,
          sender_id: 'test_user_bengali',
          sender_name: 'Bengali Tester',
          message: 'mango50'
        }
      }]
    }]
  };

  const body = JSON.stringify(webhookPayload);
  const hmac = crypto.createHmac('sha256', 'b7ab0b50e5704e00c69cbd95f726e3e4');
  hmac.update(body);
  const signature = 'sha256=' + hmac.digest('hex');

  try {
    const res = await fetch(`http://localhost:8787/webhook/${userId}`, {
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
