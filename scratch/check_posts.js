const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bbfqyskkwustlrbxqajz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZnF5c2trd3VzdGxyYnhxYWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NzU2NywiZXhwIjoyMDk2MjUzNTY3fQ.Uf4xEEAifRgGe4GZRD77AotswAc6_uHsLMVOzwFhTyE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Fetching last 5 scheduled posts...');
  const { data, error } = await supabase
    .from('scheduled_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching posts:', error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

main();
