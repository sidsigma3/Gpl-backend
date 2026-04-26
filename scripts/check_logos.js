import { supabase } from '../src/lib/supabase.js';

async function checkLogos() {
  const { data } = await supabase.from('ch_teams_cache').select('data').limit(5);
  data.forEach((t, i) => {
    console.log(`Team ${i+1} logo:`, t.data.logo || t.data.team_logo);
  });
}

checkLogos();
