const crypto = require('crypto');

const userId = '8edf1810-b3f4-40b8-a554-2325dbe55fd8';
const pageId = '452281641312964';
const postId = '452281641312964_122183681654629798';
const secret = 'b7ab0b50e5704e00c69cbd95f726e3e4'; // Correct expectedSecret from DB settings

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function sendCommentWebhook() {
  const commentId = `test_flow1_${Date.now()}`;
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
          comment_id: commentId,
          post_id: postId,
          sender_id: '27130268496625212',
          sender_name: 'Tester Flow',
          message: 'Flow1'
        }
      }]
    }]
  };

  const body = JSON.stringify(webhookPayload);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  const signature = 'sha256=' + hmac.digest('hex');

  console.log(`[Local Test] Sending signed comment webhook...`);
  const res = await fetch(`http://localhost:8787/webhook/${userId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': signature
    },
    body
  });
  console.log(`Comment Webhook Response: ${res.status} ${res.statusText}`);
}

async function sendPostbackWebhook() {
  const nodeId = '0c22f4bb-d61f-4b1b-b415-d16557eaef67';
  const payload = `FLOW_NODE_ID:${nodeId}:pf`;

  const webhookPayload = {
    object: 'page',
    entry: [{
      id: pageId,
      time: Date.now(),
      messaging: [{
        sender: { id: '27130268496625212' },
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

  console.log(`[Local Test] Sending signed postback webhook...`);
  const res = await fetch(`http://localhost:8787/webhook/${userId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': signature
    },
    body
  });
  console.log(`Postback Webhook Response: ${res.status} ${res.statusText}`);
}

async function run() {
  await sendCommentWebhook();
  await sleep(3000);
  await sendPostbackWebhook();
}

run();
