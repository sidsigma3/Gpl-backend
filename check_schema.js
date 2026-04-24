import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const checkSchema = async () => {
    // Try to get one row from tournament_settings to see columns
    const { data, error } = await supabase.from('tournament_settings').select('*').limit(1);
    
    if (error) {
        console.error('Error fetching schema:', error);
    } else {
        console.log('Tournament Settings Rows:', data);
        if (data && data.length > 0) {
            console.log('Columns found:', Object.keys(data[0]));
        } else {
            console.log('Table is empty, trying to query rpc or information_schema...');
            // Fallback: try to see if we can get anything
            const { data: info, error: infoError } = await supabase.rpc('get_table_columns', { table_name: 'tournament_settings' });
            if (infoError) console.error('RPC failed, table might be empty and no RPC defined.');
            else console.log('RPC Info:', info);
        }
    }
    process.exit();
};

checkSchema();
