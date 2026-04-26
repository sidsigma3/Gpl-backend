import { supabase } from '../src/lib/supabase.js';

async function fixLeaderboard() {
  const { data: tourney2025 } = await supabase.from('tournaments').select('*').eq('api_tournament_id', '1499216').single();
  const { data: tourney2026 } = await supabase.from('tournaments').select('*').eq('api_tournament_id', '1995185').single();
  
  console.log('Fixing leaderboard records...');

  // 1. Fix the legacy record (where tournament_id is null)
  // We'll just update the tournament_id column and leave the integer 'id' alone.
  const { error: fix2025 } = await supabase
    .from('ch_leaderboard_cache')
    .update({ 
      tournament_id: tourney2025.id
    })
    .is('tournament_id', null);

  if (fix2025) console.error('Error fixing 2025 LB:', fix2025.message);
  else console.log('✅ Linked legacy leaderboard to 2025.');

  // 2. Create an empty leaderboard for 2026 if it doesn't exist
  const { data: existing2026 } = await supabase
    .from('ch_leaderboard_cache')
    .select('*')
    .eq('tournament_id', tourney2026.id)
    .maybeSingle();

  if (!existing2026) {
    const { error: init2026 } = await supabase
      .from('ch_leaderboard_cache')
      .insert({
        tournament_id: tourney2026.id,
        data: [],
        synced_at: new Date().toISOString()
      });

    if (init2026) console.error('Error init 2026 LB:', init2026.message);
    else console.log('✅ Created initial empty leaderboard for 2026.');
  } else {
    console.log('2026 leaderboard already exists.');
  }
}

fixLeaderboard();
