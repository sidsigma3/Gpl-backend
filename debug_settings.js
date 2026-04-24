import { supabase } from './src/lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

const checkSettingsTable = async () => {
    const { data, error } = await supabase.from('tournament_settings').select('*');
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Current Tournament Settings:', data);
    }
    process.exit();
};

checkSettingsTable();
