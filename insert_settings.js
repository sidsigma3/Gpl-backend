import { supabase } from './src/lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

const doInsert = async () => {
    console.log('Attempting to insert tournament setting...');
    const { data, error } = await supabase
        .from('tournament_settings')
        .insert([{ 
            id: 1, 
            name: 'Govindaplly Premier League 2', 
            cricheroes_id: '1499216' 
        }]);

    if (error) {
        console.error('Insert failed:', error);
    } else {
        console.log('Insert successful:', data);
    }
    process.exit();
};

doInsert();
