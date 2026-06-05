import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://ntykmehhpvirnczycjpn.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50eWttZWhocHZpcm5jenljanBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDYwMzcyMSwiZXhwIjoyMDk2MTc5NzIxfQ.36EJUTkQJxwx4AmsvLdJbPwCO_MEYjJbaCvfmypnUuw');

async function test() {
  const docId = 'bf2b395c-e481-42dc-b60e-cd13b8796666';
  
  // 1. Get original content
  const { data: doc1 } = await supabase.from('documents').select('*').eq('id', docId).single();
  console.log("Original content starts with:", doc1.original_content.substring(0, 20));

  // 2. Update it
  const newContent = doc1.original_content + "\n\nTEST UPDATE";
  const { error } = await supabase.from('documents').update({
    original_content: newContent
  }).eq('id', docId);
  console.log("Update error?", error);

  // 3. Select it again
  const { data: doc2 } = await supabase.from('documents').select('*').eq('id', docId).single();
  console.log("New content ends with:", doc2.original_content.substring(doc2.original_content.length - 20));
}

test();
