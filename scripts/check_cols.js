import { supabase } from '../src/lib/supabase.js';

async function checkCols() {
  const { data, error } = await supabase.from('ch_leaderboard_cache').select('*').limit(1);
  if (error) console.error(error);
  else {
    console.log('Keys:', Object.keys(data[0] || {}));
  }
}

checkCols();
