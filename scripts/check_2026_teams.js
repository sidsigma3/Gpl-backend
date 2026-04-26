import { supabase } from '../src/lib/supabase.js';

async function checkTeams() {
  const { data: tourney } = await supabase.from('tournaments').select('*').eq('year', 2026).single();
  
  const { data: teams, error } = await supabase
    .from('ch_teams_cache')
    .select('*')
    .eq('tournament_id', tourney.id);

  if (error) {
    console.error(error);
  } else {
    console.log(`Found ${teams.length} teams for 2026.`);
    teams.forEach(t => {
      const d = t.data;
      console.log(`- [${t.id}] ${d.team_name} (Players: ${d.players?.length || 0})`);
    });
  }
}

checkTeams();
