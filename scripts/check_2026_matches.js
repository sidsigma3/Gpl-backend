import { supabase } from '../src/lib/supabase.js';

async function checkMatches() {
  const { data: tourney } = await supabase.from('tournaments').select('*').eq('year', 2026).single();
  
  const { data: matches, error } = await supabase
    .from('ch_matches_cache')
    .select('*')
    .eq('tournament_id', tourney.id);

  if (error) {
    console.error(error);
  } else {
    console.log(`Found ${matches.length} matches for 2026.`);
    matches.forEach(m => {
      const d = m.data;
      console.log(`- [${m.id}] ${d.team_a} vs ${d.team_b} (${d.match_start_time}) - ${d.status}`);
    });
  }
}

checkMatches();
