const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bbfqyskkwustlrbxqajz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZnF5c2trd3VzdGxyYnhxYWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NzU2NywiZXhwIjoyMDk2MjUzNTY3fQ.Uf4xEEAifRgGe4GZRD77AotswAc6_uHsLMVOzwFhTyE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Fetching connected pages...');
  const { data, error } = await supabase
    .from('page_connections')
    .select('id, page_id, page_name, access_token, is_active, whatsapp_phone_number_id, instagram_account_id, is_whatsapp_active, is_instagram_active')
    .order('connected_at', { ascending: false });

  if (error) {
    console.error('Error fetching page connections:', error);
    return;
  }

  const maskedData = data.map(c => {
    const token = c.access_token || '';
    const maskedToken = token.length > 15 
      ? `${token.substring(0, 8)}...${token.substring(token.length - 8)}` 
      : 'INVALID/EMPTY';
    return {
      ...c,
      access_token: maskedToken,
      token_length: token.length
    };
  });

  console.log(JSON.stringify(maskedData, null, 2));
}

main();
