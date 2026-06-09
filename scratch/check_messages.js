const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bbfqyskkwustlrbxqajz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZnF5c2trd3VzdGxyYnhxYWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NzU2NywiZXhwIjoyMDk2MjUzNTY3fQ.Uf4xEEAifRgGe4GZRD77AotswAc6_uHsLMVOzwFhTyE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Fetching last 3 messages...');
  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, fb_message_id, created_at')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(messages, null, 2));
  }
}

main();
