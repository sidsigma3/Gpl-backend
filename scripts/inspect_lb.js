import { supabase } from '../src/lib/supabase.js';

async function inspectLeaderboard() {
  const tourneyId = 'c97cc151-373b-4f4e-ae50-4a55b721eeeb';
  
  const { data, error } = await supabase
    .from('ch_leaderboard_cache')
    .select('*')
    .eq('tournament_id', tourneyId)
    .maybeSingle();

  if (data && data.data?.length > 0) {
    console.log('Full First Item:', JSON.stringify(data.data[0], null, 2));
  }
}

inspectLeaderboard();
