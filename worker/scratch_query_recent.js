const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bbfqyskkwustlrbxqajz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZnF5c2trd3VzdGxyYnhxYWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NzU2NywiZXhwIjoyMDk2MjUzNTY3fQ.Uf4xEEAifRgGe4GZRD77AotswAc6_uHsLMVOzwFhTyE');

async function run() {
  const { data: page, error } = await supabase
    .from('page_connections')
    .select('*')
    .eq('page_id', '452281641312964')
    .single();
  
  if (error || !page) {
    console.error("Error fetching page connection:", error || "Not found");
    return;
  }

  const token = page.access_token;
  // Comment ID that has not been replied to yet
  const commentId = '122183680862629798_1724016462107308'; 
  const imageUrl = 'https://bbfqyskkwustlrbxqajz.supabase.co/storage/v1/object/public/media_assets/8edf1810-b3f4-40b8-a554-2325dbe55fd8/rw8pkw1o5cb-1781049452572.jpeg';

  console.log("Sending raw image private reply...");
  try {
    const res = await fetch(`https://graph.facebook.com/v25.0/me/messages?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: {
          attachment: {
            type: "image",
            payload: {
              url: imageUrl,
              is_reusable: true
            }
          }
        }
      })
    });
    console.log("Image response status:", res.status);
    const imgJson = await res.json();
    console.log("Image response:", imgJson);
  } catch (e) {
    console.error("Image error:", e);
  }
}
run();
