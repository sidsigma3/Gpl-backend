import { supabase } from '../src/lib/supabase.js';

async function checkLeaderboard() {
  const { data: tourney } = await supabase.from('tournaments').select('*').eq('year', 2026).single();
  
  const { data, error } = await supabase
    .from('ch_leaderboard_cache')
    .select('*')
    .eq('tournament_id', tourney.id)
    .maybeSingle();

  if (error) {
    console.error(error);
  } else {
    console.log(`2026 Leaderboard: ${data ? 'Found' : 'Missing'}`);
  }
  
  const { data: all } = await supabase.from('ch_leaderboard_cache').select('*');
  console.log(`Total leaderboard records: ${all.length}`);
  all.forEach(lb => console.log(`- Tournament ID: ${lb.tournament_id}`));
}

checkLeaderboard();
