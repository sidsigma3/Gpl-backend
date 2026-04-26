import { supabase } from '../src/lib/supabase.js';

async function listTourneys() {
  const { data, error } = await supabase.from('tournaments').select('*');
  if (error) console.error(error);
  else console.log(data);
}

listTourneys();
