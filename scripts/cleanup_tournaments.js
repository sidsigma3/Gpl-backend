import { supabase } from '../src/lib/supabase.js';

async function cleanup() {
  console.log('Cleaning up placeholder tournaments...');
  
  const { data, error } = await supabase
    .from('tournaments')
    .update({ is_active: false })
    .in('api_tournament_id', ['legacy_s1', 'current_s2']);

  if (error) {
    console.error('Error during cleanup:', error.message);
  } else {
    console.log('Placeholders deactivated.');
  }
}

cleanup();
