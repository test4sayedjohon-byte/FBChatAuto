import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ntykmehhpvirnczycjpn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50eWttZWhocHZpcm5jenljanBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDYwMzcyMSwiZXhwIjoyMDk2MTc5NzIxfQ.36EJUTkQJxwx4AmsvLdJbPwCO_MEYjJbaCvfmypnUuw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const docId = 'bf2b395c-e481-42dc-b60e-cd13b8796666';
  const userId = '50b556ac-2942-4a49-8753-71248bf13c84';
  
  // 1. Update document
  const newContent = "This is the newly saved knowledge " + Date.now();
  await supabase.from('documents').update({
    original_content: newContent
  }).eq('id', docId);
  
  console.log("Updated document to:", newContent);

  // 2. Fetch API
  const res = await fetch('http://localhost:8787/api/documents/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId: docId, userId })
  });
  
  const text = await res.text();
  console.log("API response:", text);

  // 3. Select document
  const { data: doc2 } = await supabase.from('documents').select('*').eq('id', docId).single();
  console.log("Final document content:", doc2.original_content);
}

test();
