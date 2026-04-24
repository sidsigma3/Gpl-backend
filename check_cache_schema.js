import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const checkCacheSchema = async () => {
    // Check ch_matches_cache
    const { data: mData, error: mError } = await supabase.from('ch_matches_cache').select('*').limit(1);
    console.log('Matches Columns:', mData && mData.length > 0 ? Object.keys(mData[0]) : 'Empty');
    
    // Check ch_teams_cache
    const { data: tData, error: tError } = await supabase.from('ch_teams_cache').select('*').limit(1);
    console.log('Teams Columns:', tData && tData.length > 0 ? Object.keys(tData[0]) : 'Empty');
    
    process.exit();
};

checkCacheSchema();
