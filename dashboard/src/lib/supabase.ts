import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ntykmehhpvirnczycjpn.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50eWttZWhocHZpcm5jenljanBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDM3MjEsImV4cCI6MjA5NjE3OTcyMX0.KkqEuIJsMw8UuXs85K5sc66r9znPYUcHuCFyakr265g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
