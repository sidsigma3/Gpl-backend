import { supabase } from '../src/lib/supabase.js';

const tournamentId = '86fe448b-cd82-4027-8030-2076645b8c32';

const squads = {
  "SR SUPER KINGS": [
    { name: "Baladev Kichapadia", role: "All Rounder", age: 21 },
    { name: "Chittaranjan Barik", role: "Right Hand Batsman", age: 19 },
    { name: "Pinkeswar Killa", role: "All Rounder", age: 17 },
    { name: "Kiswar Gouda", role: "Pure Batsman", age: 30 },
    { name: "Deepak Durlia", role: "Right Hand Batsman", age: 23 },
    { name: "Purna Khilla", role: "Right Hand Batsman", age: 29 },
    { name: "Balia Rangarai", role: "Right Hand Batsman", age: 25 },
    { name: "Santosh Golari", role: "Bowling All Rounder", age: 20 },
    { name: "Lingaraj Kumar", role: "Batting All Rounder", age: 25 },
    { name: "Ajaya Kumar Gunjia", role: "All Rounder", age: 20 },
    { name: "Debasish Durlia", role: "Right Hand Batsman", age: 19 },
    { name: "Trinath Durlia", role: "Right Hand Batsman", age: 33 },
    { name: "Sadhu Pujari", role: "Right Hand Batsman", age: 21 },
    { name: "Sanu", role: "Right Hand Batsman", age: 25 },
    { name: "Purna Sagaria", role: "Right Hand Batsman", age: 22 },
    { name: "Pratyush Rath", role: "All Rounder", age: 23 },
    { name: "Kartik Sagaria", role: "Right Hand Batsman", age: 30 }
  ],
  "RB ROYALS": [
    { name: "Lambodar Bad-Nike (BABLU)", role: "Right Hand Batsman", age: 25 },
    { name: "Guru Kirshani", role: "All Rounder", age: 22 },
    { name: "Gokul Chandra Pujari", role: "Right Hand Batsman", age: 22 },
    { name: "Debendra Golari", role: "Right Hand Batsman", age: 21 },
    { name: "Kedar Nayak", role: "Right Hand Batsman", age: 22 },
    { name: "Debasish Gouda", role: "Right Hand Batsman", age: 21 },
    { name: "Debaa Pradhan", role: "Wicket Keeper", age: 29 },
    { name: "Bhaktaram Gouda", role: "Right Hand Batsman", age: 17 },
    { name: "Rabindra Nayak", role: "Right Hand Batsman", age: 18 },
    { name: "Kartik Anumalia", role: "Right Hand Batsman", age: 28 },
    { name: "Khageswar Rudhei", role: "Finisher", age: 19 },
    { name: "Kishore Rudei", role: "Right Hand Batsman", age: 29 },
    { name: "Kailash Nayak", role: "Right Hand Batsman", age: 24 },
    { name: "K Aditya Dora", role: "Right Hand Batsman", age: 22 },
    { name: "Santunu Bhukta", role: "Right Hand Batsman", age: 23 }
  ],
  "GOLDEN BOYZ": [
    { name: "Upendra Pujari", role: "Wicket Keeper Batsman", age: 23 },
    { name: "Krishna Paika", role: "Right Hand Batsman", age: 19 },
    { name: "Lalit Golari", role: "Middle Order", age: 19 },
    { name: "Mana Golari", role: "All Rounder", age: 21 },
    { name: "Ranjeet Kumar Gouda", role: "Opener", age: 27 },
    { name: "Sarath Pujari", role: "All Rounder", age: 19 },
    { name: "Krishna Kichapadia", role: "Right Hand Batsman", age: 20 },
    { name: "Bhagaban Nayak", role: "Right Hand Batsman", age: 25 },
    { name: "Benu Dhar Nayak", role: "Bowling All Rounder", age: 18 },
    { name: "Dasamanta Pangi", role: "Right Hand Batsman", age: 23 },
    { name: "Sankar Muduli", role: "Right Hand Batsman", age: 16 },
    { name: "Damdar Gouda", role: "Right Hand Batsman", age: 22 },
    { name: "Sankar Mahanti", role: "Right Hand Batsman", age: 16 },
    { name: "Gopabandhu Nayak", role: "All Rounder", age: 21 },
    { name: "Padman Pujari", role: "Right Hand Batsman", age: 43 },
    { name: "Bijay Kumar", role: "Right Hand Batsman", age: 25 },
    { name: "Chinaya Praks Samal", role: "Right Hand Batsman", age: 25 },
    { name: "U. Goutam", role: "All Rounder", age: 15 }
  ],
  "GPL STRIKERS": [
    { name: "Kartik Gouda", role: "Right Hand Batsman", age: 20 },
    { name: "Rabindranath Khilla", role: "All Rounder", age: 20 },
    { name: "Jitu Nayak", role: "Right Hand Batsman", age: 25 },
    { name: "Kiran", role: "Right Hand Batsman", age: 18 },
    { name: "Chandra Khila", role: "Middle Order", age: 19 },
    { name: "Jinu Totapadia", role: "Right Hand Batsman", age: 20 },
    { name: "Ayushman Nayak", role: "All Rounder", age: 12 },
    { name: "Jyotirmaya Turuk", role: "Right Hand Batsman", age: 33 },
    { name: "Tularam Nayak", role: "All Rounder", age: 30 },
    { name: "Trinath Anumalia", role: "Bowling All Rounder", age: 25 },
    { name: "Chitaranjan Nayak", role: "Right Hand Batsman", age: 35 },
    { name: "Eka Das", role: "Finisher", age: 30 },
    { name: "Rinku Mohanty", role: "Right Hand Batsman", age: 25 },
    { name: "Sagar Nayak", role: "Right Arm Fast-Medium", age: 24 },
    { name: "Kartik Khara", role: "Right Hand Batsman", age: 28 },
    { name: "TL Gopal Krishna", role: "Right Hand Batsman", age: 26 },
    { name: "Padmacharan <Budha>", role: "Right Hand Batsman", age: 29 },
    { name: "Sarat Chandra Alang", role: "Right Hand Batsman", age: 18 }
  ],
  "PORICHHA PALTONS": [
    { name: "Sibaprasad Mahapatra", role: "Right Hand Batsman", age: 35 },
    { name: "Jitu Gouda", role: "Right Hand Batsman", age: 21 },
    { name: "Mangalu Badanayak", role: "Pure Batsman", age: 21 },
    { name: "Ajay Rudei", role: "Right Hand Batsman", age: 23 },
    { name: "Nihar", role: "Wicket Keeper", age: 41 },
    { name: "Krushna Muduli", role: "Right Hand Batsman", age: 19 },
    { name: "Rama Badanayak", role: "Middle Order", age: 22 },
    { name: "Soumya Ranjan Pradhan", role: "Right Hand Batsman", age: 19 },
    { name: "Jagannath Hantal", role: "Right Hand Batsman", age: 19 },
    { name: "Debajeet Beura", role: "Right Hand Batsman", age: 32 },
    { name: "Khagaswar Pattanaik", role: "Opener", age: 30 },
    { name: "Ishwar Badnayak", role: "All Rounder", age: 20 },
    { name: "Harihara Nayak", role: "Right Hand Batsman", age: 29 },
    { name: "Susanta Pujari", role: "Right Hand Batsman", age: 17 },
    { name: "Sanu Badnaik", role: "Bowling All Rounder", age: 19 },
    { name: "Arun Kumar Madala", role: "Finisher", age: 16 },
    { name: "Dhanesh Khilla", role: "All Rounder", age: 20 },
    { name: "Sadashiva Hantal", role: "All Rounder", age: 32 }
  ]
};

async function importSquads() {
  console.log('--- STARTING PDF ROSTER IMPORT ---');
  
  for (const [teamName, players] of Object.entries(squads)) {
    // 1. Find the team in the cache
    const { data: teamRecord, error: findError } = await supabase
      .from('ch_teams_cache')
      .select('*')
      .eq('tournament_id', tournamentId)
      .ilike('data->>team_name', teamName)
      .single();

    if (findError || !teamRecord) {
      console.error(`❌ Could not find team: ${teamName}`);
      continue;
    }

    // 2. Prepare merged players list
    // We keep existing players and add new ones (preventing duplicates by name)
    const existingPlayers = teamRecord.data.players || [];
    const playerNames = new Set(existingPlayers.map(p => p.player_name || p.name));
    
    const newPlayers = players
      .filter(p => !playerNames.has(p.name))
      .map(p => ({
        player_id: `manual_${Math.random().toString(36).substr(2, 9)}`,
        player_name: p.name,
        player_role: p.role,
        player_age: p.age
      }));

    const finalPlayers = [...existingPlayers, ...newPlayers];

    // 3. Update the cache
    const { error: updateError } = await supabase
      .from('ch_teams_cache')
      .update({
        data: {
          ...teamRecord.data,
          players: finalPlayers
        }
      })
      .eq('id', teamRecord.id);

    if (updateError) {
      console.error(`❌ Error updating ${teamName}:`, updateError.message);
    } else {
      console.log(`✅ Updated ${teamName} with ${newPlayers.length} new players (Total: ${finalPlayers.length})`);
    }
  }
  
  console.log('--- IMPORT COMPLETE ---');
}

importSquads();
