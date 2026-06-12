import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .dev.vars
const envFile = fs.readFileSync('.dev.vars', 'utf8');
const env = envFile.split('\n').reduce((acc: any, line) => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    acc[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
  }
  return acc;
}, {});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

async function runTest() {
  console.log('--- Testing AI Follow-Up Automation ---');
  
  // 1. Get an active page connection
  const { data: pageConns, error: pcError } = await supabase
    .from('page_connections')
    .select('*')
    .eq('is_active', true)
    .limit(1);
    
  if (pcError || !pageConns || pageConns.length === 0) {
    console.error('No active page connection found.', pcError);
    return;
  }
  
  const pageConnection = pageConns[0];
  console.log('Using Page Connection:', pageConnection.page_name || pageConnection.page_id);

  // Store original settings to restore later
  const originalEnabled = pageConnection.follow_up_enabled;
  const originalPrompt = pageConnection.follow_up_prompt;
  const originalDelay = pageConnection.follow_up_delay_minutes;
  const originalMax = pageConnection.follow_up_max_count;

  // 2. Configure page connection for immediate testing
  console.log('Temporarily enabling Follow-Up settings on connection...');
  await supabase.from('page_connections').update({ 
    follow_up_enabled: true,
    follow_up_prompt: 'Politely follow up and check if they are still interested in our automation setup.',
    follow_up_delay_minutes: 30, // 30 minutes
    follow_up_max_count: 1
  }).eq('id', pageConnection.id);

  // 3. Create a dummy session
  const senderId = 'test_followup_user_' + Date.now();
  console.log('Test Sender ID:', senderId);
  
  const { data: sessionData, error: sessionError } = await supabase.rpc(
    'get_or_create_session',
    {
      p_page_id: pageConnection.page_id,
      p_sender_id: senderId,
      p_user_id: pageConnection.user_id,
      p_session_timeout: 1800,
    }
  );
  
  if (sessionError || !sessionData) {
    console.error('Session Error:', sessionError);
    return;
  }
  
  const sessionId = sessionData.o_session_id;
  console.log('Session ID:', sessionId);
  
  // 4. Insert dummy messages where last message is by assistant
  console.log('Inserting conversation messages...');
  const messages = [
    { role: 'user', content: 'Hello, what are your automation rates?' },
    { role: 'assistant', content: 'Hi! Our rates start at $999 for the phone farming box. Would you like to check out some product images or details?' }
  ];
  
  for (let i = 0; i < messages.length; i++) {
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: pageConnection.user_id,
      role: messages[i].role,
      content: messages[i].content,
      fb_message_id: `dummy_fu_${Date.now()}_${i}`
    });
    await new Promise(r => setTimeout(r, 50));
  }

  // 5. Update session's last_message_at to 45 minutes ago so it is idle and picked up by sweeper
  console.log('Setting session last_message_at to 45 minutes ago...');
  const fortyFiveMinsAgo = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  await supabase
    .from('chat_sessions')
    .update({ 
      last_message_at: fortyFiveMinsAgo,
      follow_up_count: 0
    })
    .eq('id', sessionId);

  // 6. Run the Follow-Up sweeper
  console.log('Running Follow-Up Sweeper...');
  
  const { runFollowUpSweeper } = await import('./src/chat/follow-up');
  
  // Mock Bindings Env object
  const mockEnv: any = {
    Bindings: {
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_SERVICE_KEY: env.SUPABASE_SERVICE_KEY,
      IS_LOCAL_DEV: 'true'
    }
  };

  await runFollowUpSweeper(supabase, mockEnv.Bindings);

  // 7. Verify results
  console.log('Verifying follow-up messages inside the database...');
  const { data: newMsgs } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (newMsgs && newMsgs.length > 2) {
    console.log('✅ Success! Follow-up message detected:');
    console.log('-------------------------------------------');
    console.log(`Role: ${newMsgs[0].role}`);
    console.log(`Content: ${newMsgs[0].content}`);
    console.log(`Metadata:`, JSON.stringify(newMsgs[0].metadata));
    console.log('-------------------------------------------');
  } else {
    console.error('❌ Failed. No follow-up message generated.');
  }

  // 8. Restore original settings to keep database clean
  console.log('Restoring original connection settings...');
  await supabase.from('page_connections').update({ 
    follow_up_enabled: originalEnabled,
    follow_up_prompt: originalPrompt,
    follow_up_delay_minutes: originalDelay,
    follow_up_max_count: originalMax
  }).eq('id', pageConnection.id);

  // 9. Cleanup session
  console.log('Cleaning up test session and messages...');
  await supabase.from('chat_sessions').delete().eq('id', sessionId);
  console.log('Done!');
}

runTest().catch(console.error);
