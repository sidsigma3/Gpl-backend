import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  console.log('--- Database Diagnostics ---');
  
  // 1. Check ch_matches_cache
  const { error: err1 } = await supabase.from('ch_matches_cache').select('count').limit(1);
  console.log('ch_matches_cache:', err1 ? '❌ ' + err1.message : '✅ OK');

  // 2. Check ch_match_details_cache
  const { error: err2 } = await supabase.from('ch_match_details_cache').select('count').limit(1);
  console.log('ch_match_details_cache:', err2 ? '❌ ' + err2.message : '✅ OK');

  // 3. Try a raw SQL style check for table names
  const { data: tables, error: err3 } = await supabase.rpc('get_tables'); // If this exists
  if (err3) {
      console.log('Table List via RPC: Not available');
  } else {
      console.log('Tables:', tables);
  }
}

check();
