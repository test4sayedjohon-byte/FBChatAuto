const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bbfqyskkwustlrbxqajz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZnF5c2trd3VzdGxyYnhxYWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NzU2NywiZXhwIjoyMDk2MjUzNTY3fQ.Uf4xEEAifRgGe4GZRD77AotswAc6_uHsLMVOzwFhTyE');

async function run() {
  const { data: c, error } = await supabase
    .from('page_connections')
    .select('*')
    .eq('whatsapp_phone_number_id', '1104393882765374')
    .single();
  
  if (error) {
    console.error("Error fetching connection:", error);
  } else {
    console.log("Page Connection Details:", {
      id: c.id,
      user_id: c.user_id,
      updated_at: c.updated_at,
      is_whatsapp_active: c.is_whatsapp_active,
      is_active: c.is_active,
      token_preview: c.access_token ? `${c.access_token.substring(0, 15)}...${c.access_token.substring(c.access_token.length - 15)}` : null
    });
  }
}
run();
