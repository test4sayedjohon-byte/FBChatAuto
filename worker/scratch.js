import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://ntykmehhpvirnczycjpn.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50eWttZWhocHZpcm5jenljanBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDYwMzcyMSwiZXhwIjoyMDk2MTc5NzIxfQ.36EJUTkQJxwx4AmsvLdJbPwCO_MEYjJbaCvfmypnUuw');
async function run() {
  const { data, error } = await supabase.rpc('get_or_create_session', {
    p_page_id: 'test_page',
    p_sender_id: 'test_sender',
    p_user_id: '50b556ac-2942-4a49-8753-71248bf13c84',
    p_session_timeout: 1800
  });
  console.log("Data:", typeof data, Array.isArray(data) ? 'array' : 'object', JSON.stringify(data));
}
run();
