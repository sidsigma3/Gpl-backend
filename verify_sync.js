import { supabase } from './src/lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

const countData = async () => {
    const { count: matches } = await supabase.from('ch_matches_cache').select('*', { count: 'exact', head: true });
    const { count: teams } = await supabase.from('ch_teams_cache').select('*', { count: 'exact', head: true });
    
    console.log('--- Sync Results ---');
    console.log('Matches in DB:', matches);
    console.log('Teams in DB:', teams);
    process.exit();
};

countData();
