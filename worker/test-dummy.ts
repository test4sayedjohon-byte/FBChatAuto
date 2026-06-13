import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .dev.vars
const envFile = fs.readFileSync('.dev.vars', 'utf8');
const env = envFile.split('\n').reduce((acc: any, line: any) => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    acc[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
  }
  return acc;
}, {});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

async function runTest() {
  console.log('--- Testing Sliding Window Summarization ---');
  
  // 1. Get a test page connection (from fbchatauto-sg database)
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
  
  // Ensure profiling is enabled for the test
  await supabase.from('page_connections').update({ 
    enable_customer_profiling: true
  }).eq('id', pageConnection.id);
  pageConnection.enable_customer_profiling = true;
  
  // 2. Create a dummy session
  const senderId = 'test_dummy_user_' + Date.now();
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
  
  // 3. Insert exactly 10 messages (5 user, 5 assistant)
  console.log('Inserting 10 dummy messages...');
  const messages = [
    { role: 'user', content: 'Hi, I need a phone farming setup.' },
    { role: 'assistant', content: 'Hello! I can help with that. Are you looking for 5-6 phones or a larger setup?' },
    { role: 'user', content: 'I want 5-6 phones.' },
    { role: 'assistant', content: 'Great. Do you need a dedicated server or just the phones?' },
    { role: 'user', content: 'Just the phones.' },
    { role: 'assistant', content: 'Understood. Would you prefer WhatsApp or Telegram for communication?' },
    { role: 'user', content: 'I prefer WhatsApp.' },
    { role: 'assistant', content: 'Noted. WhatsApp it is. Are you based in Dhaka?' },
    { role: 'user', content: 'Yes, I am in Dhaka.' },
    { role: 'assistant', content: 'Perfect. Our team in Dhaka will contact you via WhatsApp soon.' }
  ];
  
  for (let i = 0; i < messages.length; i++) {
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: pageConnection.user_id,
      role: messages[i].role,
      content: messages[i].content,
      fb_message_id: `dummy_${Date.now()}_${i}`
    });
    // Tiny delay to ensure chronological ordering
    await new Promise(r => setTimeout(r, 50));
  }
  
  // 4. Trigger the summarization logic manually
  console.log('Triggering Summarization...');
  
  const { triggerSlidingWindowSummarization } = await import('./src/chat/summarize.ts');
  
  await triggerSlidingWindowSummarization(
    supabase,
    sessionId,
    pageConnection as any,
    senderId
  );
  
  console.log('Checking generated profile...');
  const { data: profile } = await supabase.from('customer_profiles').select('*').eq('sender_id', senderId).maybeSingle();
  console.log('Final Profile Summary:', profile?.summary || 'Not generated');
}

runTest();
