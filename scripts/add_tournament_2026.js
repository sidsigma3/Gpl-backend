import { supabase } from '../src/lib/supabase.js';

async function registerTournaments() {
  console.log('Registering Tournaments...');
  
  const { data, error } = await supabase
    .from('tournaments')
    .upsert([
      {
        name: 'Govindapally Premier League-2025',
        year: 2025,
        is_active: true, // Keep it active so we can sync/view it
        api_tournament_id: '1499216'
      },
      {
        name: 'Govindapally Premier League-2026',
        year: 2026,
        is_active: true,
        api_tournament_id: '1995185'
      }
    ], { onConflict: 'api_tournament_id' })
    .select();

  if (error) {
    console.error('Error adding tournaments:', error.message);
  } else {
    console.log('Tournaments registered:');
    data.forEach(t => console.log(`- ${t.name} (ID: ${t.id})`));
  }
}

registerTournaments();
