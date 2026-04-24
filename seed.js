import { supabase } from './src/lib/supabase.js';

const seedSettings = async () => {
  const { error } = await supabase
    .from('tournament_settings')
    .upsert({ 
      id: 1, 
      cricheroes_id: '1499216/govindaplly-premier-leauge-2',
      tournament_name: 'GPL 2'
    });

  if (error) {
    console.error('Error seeding settings:', error);
  } else {
    console.log('Tournament settings seeded successfully');
  }
  process.exit();
};

seedSettings();
