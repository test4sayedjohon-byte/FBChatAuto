const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bbfqyskkwustlrbxqajz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZnF5c2trd3VzdGxyYnhxYWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NzU2NywiZXhwIjoyMDk2MjUzNTY3fQ.Uf4xEEAifRgGe4GZRD77AotswAc6_uHsLMVOzwFhTyE');

async function run() {
  console.log("Querying all chat_assets from Supabase...");
  const { data, error } = await supabase
    .from('chat_assets')
    .select('*');

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Found ${data.length} asset(s) in Supabase.`);
  data.forEach(a => {
    console.log(`\nName: ${a.name} | Friendly: ${a.friendly_name}`);
    console.log(`  File URL: ${a.file_url}`);
    console.log(`  File Type: ${a.file_type}`);
    console.log(`  AI Auto-Send: ${a.ai_auto_send}`);
    console.log(`  Times Sent: ${a.times_sent}`);
    console.log(`  Cached Media ID: ${a.facebook_media_id || 'None'}`);
  });
}

run();
