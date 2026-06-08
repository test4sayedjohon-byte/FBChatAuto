const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bbfqyskkwustlrbxqajz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZnF5c2trd3VzdGxyYnhxYWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NzU2NywiZXhwIjoyMDk2MjUzNTY3fQ.Uf4xEEAifRgGe4GZRD77AotswAc6_uHsLMVOzwFhTyE');

async function run() {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', '8edf1810-b3f4-40b8-a554-2325dbe55fd8')
    .single();
  
  if (error) {
    console.error("Error fetching user:", error);
  } else {
    console.log("Updated User Data:");
    console.log(JSON.stringify(user, null, 2));
  }
}
run();
