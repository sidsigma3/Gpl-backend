import { supabase } from '../src/lib/supabase.js';

async function checkSquads() {
  const { data } = await supabase.from('ch_teams_cache').select('data').limit(5);
  data.forEach((t, i) => {
    console.log(`Team: ${t.data.team_name}, Players: ${t.data.players?.length || 0}`);
  });
}

checkSquads();
