const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🏁 Starting Content Copilot Integration Test...\n');

  const url = 'http://localhost:8787/api/agent/chat';

  // Helper to send message to local worker agent endpoint
  async function sendMessage(messages, channelId = null, contextType = null) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bypass-Auth': 'true'
      },
      body: JSON.stringify({
        messages,
        channelId,
        contextType,
        agentType: 'content_copilot'
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Worker API error (${res.status}): ${errText}`);
    }

    return await res.json();
  }

  try {
    // 1. Send introductory listing message
    console.log('✉️ Step 1: Requesting channel listing from Content Copilot...');
    const chatHistory = [
      { role: 'user', content: 'Can you list my connected channels?' }
    ];

    let result = await sendMessage(chatHistory);
    console.log('🤖 Response received:', JSON.stringify(result, null, 2));

    if (result.message && result.message.content) {
      chatHistory.push(result.message);
      console.log(`\n💬 Copilot: "${result.message.content}"\n`);
    } else {
      console.error('❌ Failed to get a proper response message from the Copilot.');
      process.exit(1);
    }

    // 2. Schedule a mock post
    console.log('✉️ Step 2: Requesting to schedule a post...');
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    chatHistory.push({
      role: 'user',
      content: `Awesome. Please schedule a post for my Facebook Page (661388580399300) with message "Checking out the new Content Copilot agent!" at ${tomorrow}. Also add a first comment saying "First comment here!"`
    });

    result = await sendMessage(chatHistory);
    console.log('🤖 Response received:', JSON.stringify(result, null, 2));

    if (result.message && result.message.content) {
      chatHistory.push(result.message);
      console.log(`\n💬 Copilot: "${result.message.content}"\n`);
    } else {
      console.error('❌ Failed to schedule post via Copilot.');
      process.exit(1);
    }

    // 3. List scheduled posts to verify
    console.log('✉️ Step 3: Verifying scheduled posts via Copilot...');
    chatHistory.push({
      role: 'user',
      content: 'Can you list my upcoming scheduled posts to verify?'
    });

    result = await sendMessage(chatHistory);
    console.log('🤖 Response received:', JSON.stringify(result, null, 2));

    if (result.message && result.message.content) {
      chatHistory.push(result.message);
      console.log(`\n💬 Copilot: "${result.message.content}"\n`);
    }

    // 4. Create comment moderation rule
    console.log('✉️ Step 4: Requesting to create a comment moderation rule...');
    chatHistory.push({
      role: 'user',
      content: 'Great. Now please create a comment rule for page 661388580399300: if comments contain keywords "scam" or "fraud", hide the comment and reply "Please respect our community guidelines. DM us if you have issues."'
    });

    result = await sendMessage(chatHistory);
    console.log('🤖 Response received:', JSON.stringify(result, null, 2));

    if (result.message && result.message.content) {
      chatHistory.push(result.message);
      console.log(`\n💬 Copilot: "${result.message.content}"\n`);
    }

    // 5. List comment rules to verify
    console.log('✉️ Step 5: Listing comment rules...');
    chatHistory.push({
      role: 'user',
      content: 'List my current comment moderation rules.'
    });

    result = await sendMessage(chatHistory);
    console.log('🤖 Response received:', JSON.stringify(result, null, 2));

    if (result.message && result.message.content) {
      console.log(`\n💬 Copilot: "${result.message.content}"\n`);
    }

    console.log('✅ Integration test sequence finished successfully.');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

main();
