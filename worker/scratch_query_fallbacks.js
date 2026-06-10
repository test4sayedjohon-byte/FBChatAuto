const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bbfqyskkwustlrbxqajz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZnF5c2trd3VzdGxyYnhxYWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NzU2NywiZXhwIjoyMDk2MjUzNTY3fQ.Uf4xEEAifRgGe4GZRD77AotswAc6_uHsLMVOzwFhTyE');

async function run() {
  console.log("Checking all details of ai_providers...");
  const { data: providers, error } = await supabase
    .from('ai_providers')
    .select('*');

  if (error) {
    console.error("Error:", error);
    return;
  }

  providers.forEach(p => {
    console.log(`\nProvider Name: ${p.provider_name} | Display: ${p.display_name} | ID: ${p.id}`);
    console.log(`  Model Chat: ${p.model_chat}`);
    console.log(`  Model Reasoning: ${p.model_reasoning}`);
    console.log(`  Is Active Chat: ${p.is_active_chat} | Is Active Vision: ${p.is_active_vision}`);
    console.log(`  Fallback Chat Order: ${p.fallback_chat_order} | Fallback Agent Order: ${p.fallback_agent_order}`);
  });
}

run();
