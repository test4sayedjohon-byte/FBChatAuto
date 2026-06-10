const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bbfqyskkwustlrbxqajz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZnF5c2trd3VzdGxyYnhxYWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NzU2NywiZXhwIjoyMDk2MjUzNTY3fQ.Uf4xEEAifRgGe4GZRD77AotswAc6_uHsLMVOzwFhTyE');

async function run() {
  console.log("Checking page_connections custom_system_prompt...");
  const { data, error } = await supabase
    .from('page_connections')
    .select('page_id, page_name, custom_system_prompt');

  if (error) {
    console.error("Error:", error);
    return;
  }

  data.forEach(p => {
    console.log(`\nPage Name: ${p.page_name} (${p.page_id})`);
    console.log(`Custom System Prompt:\n${p.custom_system_prompt || 'None'}`);
  });
}

run();
