const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🏁 Starting Visual Flow Copilot Integration Test...\n');

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
        agentType: 'flow_copilot'
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Worker API error (${res.status}): ${errText}`);
    }

    return await res.json();
  }

  try {
    const chatHistory = [];

    // 1. List flows
    console.log('✉️ Step 1: Listing visual flows...');
    chatHistory.push({ role: 'user', content: 'Please list my current visual automation flows.' });
    let result = await sendMessage(chatHistory);
    console.log('🤖 Response:', result.message.content);
    chatHistory.push(result.message);

    // 2. Create flow
    console.log('\n✉️ Step 2: Creating a new flow...');
    chatHistory.push({
      role: 'user',
      content: 'Create a new visual flow named "E2E Welcome Flow" with a message block containing text "Hello customer!" at position x:100 y:150, connected to a delay block of 15 seconds at position x:400 y:150.'
    });
    result = await sendMessage(chatHistory);
    console.log('🤖 Response:', result.message.content);
    chatHistory.push(result.message);

    // Find the new flow ID from the response or list
    console.log('\n✉️ Step 3: Fetching the updated flow list to extract the flow ID...');
    chatHistory.push({ role: 'user', content: 'What flows do I have now? Tell me the name and ID.' });
    result = await sendMessage(chatHistory);
    console.log('🤖 Response:', result.message.content);
    chatHistory.push(result.message);

    // Let's parse the flow ID
    const content = result.message.content;
    const match = content.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    if (!match) {
      console.warn('⚠️ Could not automatically parse a flow UUID from the response. Showing full response instead.');
      console.log('Ensure wrangler dev is running and database has the flows.');
      return;
    }
    const flowId = match[0];
    console.log(`🎯 Found Flow ID: ${flowId}`);

    // 4. Retrieve flow details
    console.log(`\n✉️ Step 4: Retrieving details of flow ${flowId}...`);
    chatHistory.push({ role: 'user', content: `Please fetch the details of flow ${flowId} and explain its nodes and edges.` });
    result = await sendMessage(chatHistory);
    console.log('🤖 Response:', result.message.content);
    chatHistory.push(result.message);

    // 5. Update flow metadata & nodes
    console.log(`\n✉️ Step 5: Modifying flow ${flowId}...`);
    chatHistory.push({
      role: 'user',
      content: `Please modify the flow ${flowId} to be named "Audited Welcome Flow" and add a third message block containing text "Hope that helps!" at position x:700 y:150 connected to the delay block.`
    });
    result = await sendMessage(chatHistory);
    console.log('🤖 Response:', result.message.content);
    chatHistory.push(result.message);

    // 6. Delete the flow
    console.log(`\n✉️ Step 6: Deleting flow ${flowId}...`);
    chatHistory.push({ role: 'user', content: `Please delete the flow ${flowId}.` });
    result = await sendMessage(chatHistory);
    console.log('🤖 Response:', result.message.content);
    chatHistory.push(result.message);

    console.log('\n✅ Flow Copilot E2E Integration test script executed successfully.');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

main();
