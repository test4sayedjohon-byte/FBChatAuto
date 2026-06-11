const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bbfqyskkwustlrbxqajz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZnF5c2trd3VzdGxyYnhxYWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NzU2NywiZXhwIjoyMDk2MjUzNTY3fQ.Uf4xEEAifRgGe4GZRD77AotswAc6_uHsLMVOzwFhTyE');

async function run() {
  const { data: docs, error: err } = await supabase
    .from('documents')
    .select('*');
  if (err) {
    console.error(err);
    return;
  }
  docs.forEach(d => {
    console.log(`\n========================================`);
    console.log(`DOCUMENT ID: ${d.id}`);
    console.log(`TITLE: ${d.title}`);
    console.log(`FOLDER ID: ${d.folder_id}`);
    console.log(`----------------------------------------`);
    console.log(d.original_content || d.content);
    console.log(`========================================`);
  });
}

run();
