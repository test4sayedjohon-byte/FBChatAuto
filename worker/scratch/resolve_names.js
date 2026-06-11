const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bbfqyskkwustlrbxqajz.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZnF5c2trd3VzdGxyYnhxYWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NzU2NywiZXhwIjoyMDk2MjUzNTY3fQ.Uf4xEEAifRgGe4GZRD77AotswAc6_uHsLMVOzwFhTyE";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  console.log("Fetching page connections...");
  const { data: connections, error: connErr } = await supabase
    .from('page_connections')
    .select('page_id, access_token');

  if (connErr) {
    console.error("Error fetching page connections:", connErr);
    return;
  }

  const tokenMap = {};
  connections.forEach(c => {
    tokenMap[c.page_id] = c.access_token;
  });

  console.log(`Loaded ${connections.length} page connections.`);

  console.log("Fetching chat sessions with missing sender names...");
  const { data: sessions, error: sessErr } = await supabase
    .from('chat_sessions')
    .select('id, page_id, sender_id, sender_name')
    .or('sender_name.is.null,sender_name.eq.Anonymous User');

  if (sessErr) {
    console.error("Error fetching sessions:", sessErr);
    return;
  }

  console.log(`Found ${sessions.length} sessions to resolve.`);

  for (const session of sessions) {
    const accessToken = tokenMap[session.page_id];
    if (!accessToken) {
      console.warn(`No access token found for page ${session.page_id}, skipping session ${session.id}`);
      continue;
    }

    const isWhatsApp = session.page_id.length > 15 && !isNaN(Number(session.page_id)) && session.page_id.startsWith('10');
    if (isWhatsApp) {
      // WhatsApp users are usually resolved through contact list. We'll skip here or use phone number.
      continue;
    }

    try {
      console.log(`Fetching profile for sender ${session.sender_id} using token...`);
      const fbRes = await fetch(`https://graph.facebook.com/v21.0/${session.sender_id}?fields=first_name,last_name,profile_pic`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (fbRes.ok) {
        const fbData = await fbRes.json();
        let senderName = '';
        let senderAvatar = null;

        if (fbData.first_name || fbData.last_name) {
          senderName = `${fbData.first_name || ''} ${fbData.last_name || ''}`.trim();
        }
        if (fbData.profile_pic) {
          senderAvatar = fbData.profile_pic;
        }

        if (senderName) {
          console.log(`Updating session ${session.id}: sender_name = "${senderName}"`);
          const { error: updateErr } = await supabase
            .from('chat_sessions')
            .update({ sender_name: senderName, sender_avatar: senderAvatar })
            .eq('id', session.id);

          if (updateErr) {
            console.error(`Failed to update session ${session.id}:`, updateErr.message);
          } else {
            console.log(`Successfully updated session ${session.id}`);
          }
        } else {
          console.warn(`Profile found but name is empty for sender ${session.sender_id}`);
        }
      } else {
        const errText = await fbRes.text();
        console.warn(`Failed to fetch profile for sender ${session.sender_id}: ${fbRes.status} ${errText}`);
        
        // Try Instagram profile endpoint if Page fails or returns error (e.g. for IG users)
        const igRes = await fetch(`https://graph.facebook.com/v21.0/${session.sender_id}?fields=name,username,profile_pic`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (igRes.ok) {
          const igData = await igRes.json();
          let senderName = igData.name || igData.username || '';
          let senderAvatar = igData.profile_pic || null;

          if (senderName) {
            console.log(`Updating Instagram session ${session.id}: sender_name = "${senderName}"`);
            await supabase
              .from('chat_sessions')
              .update({ sender_name: senderName, sender_avatar: senderAvatar })
              .eq('id', session.id);
          }
        }
      }
    } catch (e) {
      console.error(`Error resolving sender ${session.sender_id}:`, e);
    }

    // Rate limiting delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log("Done resolving names!");
}

run();
