const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bbfqyskkwustlrbxqajz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZnF5c2trd3VzdGxyYnhxYWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NzU2NywiZXhwIjoyMDk2MjUzNTY3fQ.Uf4xEEAifRgGe4GZRD77AotswAc6_uHsLMVOzwFhTyE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const { data: conn, error } = await supabase
    .from('page_connections')
    .select('page_name, access_token')
    .eq('page_id', '452281641312964')
    .single();

  if (error || !conn) {
    console.error('Error fetching page connection:', error);
    return;
  }

  const token = conn.access_token;
  console.log(`Checking /me for page: ${conn.page_name}`);

  const url = `https://graph.facebook.com/v21.0/me?access_token=${token}`;

  try {
    const response = await fetch(url);
    const body = await response.json();
    console.log('Result:', JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

main();
