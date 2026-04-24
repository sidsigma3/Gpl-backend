import { supabase } from './src/lib/supabase.js';

async function seedSettings() {
  const { data, error } = await supabase
    .from('settings')
    .upsert([{ 
      id: 1, 
      name: 'Govindpally Premier League', 
      cricheroes_id: '1499216' 
    }]);

  if (error) {
    console.error('Error seeding settings:', error);
  } else {
    console.log('Settings seeded successfully!');
  }
}

seedSettings();
