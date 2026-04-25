import cron from 'node-cron';
import axios from 'axios';
import { supabase } from '../lib/supabase.js';

const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL;
const SYNC_SECRET = process.env.ADMIN_TOKEN;

export const syncData = async () => {
  try {
    console.log('Starting CricHeroes sync via Next.js API...');
    
    // 1. Get current tournament settings
    const { data: settings, error: settingsError } = await supabase
      .from('tournament_settings')
      .select('*')
      .single();

    if (settingsError || !settings?.cricheroes_id) {
      console.error('Sync failed: No tournament configuration found in Supabase');
      return;
    }

    // Prepare slug (use hardcoded fallback if name isn't a slug)
    const slug = settings.cricheroes_id === '1499216' 
      ? 'govindaplly-premier-leauge-2' 
      : settings.name?.toLowerCase().replace(/ /g, '-');

    // 2. Call Python Scraper
    const response = await axios.get(`${SCRAPER_URL}/scrape/${settings.cricheroes_id}`, {
      params: { slug },
      headers: { 'x-sync-secret': SYNC_SECRET }
    });

    const { matches, teams, standings, leaderboard } = response.data;
    const timestamp = new Date().toISOString();

    console.log(`Scraped: ${matches?.length || 0} matches, ${teams?.length || 0} teams.`);
    
    // 3. Update Cache Tables
    if (matches?.length) {
      const timestamp = new Date().toISOString();
      const matchData = matches.map(m => ({
        id: m.match_id || m.id,
        data: m,
        synced_at: timestamp
      }));
      await supabase.from('ch_matches_cache').upsert(matchData);
      console.log(`Upserted ${matchData.length} matches.`);

      // 4. DEEP SYNC: Fetch details for each match (especially past ones)
      console.log('Starting Deep Sync for match details...');
      for (const m of matches) {
        const matchId = m.match_id || m.id;
        
        // Check if we already have detailed cache to save resources (Sync Once logic)
        const { data: existing } = await supabase
          .from('ch_match_details_cache')
          .select('id')
          .eq('id', matchId)
          .maybeSingle();
          
        if (existing) {
          console.log(`⏩ Skipping already cached match: ${matchId}`);
          continue; 
        }

        try {
          console.log(`Deep Syncing Match: ${matchId}`);
          const team_slug = m.team_a_name && m.team_b_name ? `${m.team_a_name}-vs-${m.team_b_name}` : slug;
          
          const detailRes = await axios.get(`${SCRAPER_URL}/scrape/match/${matchId}`, {
            params: { 
              slug,
              team_a: m.team_a_name || m.team_a,
              team_b: m.team_b_name || m.team_b
            },
            headers: { 'x-sync-secret': SYNC_SECRET }
          });

          if (detailRes.data.success) {
            const { error: upsertError } = await supabase.from('ch_match_details_cache').upsert([{
              id: matchId,
              data: detailRes.data.details,
              synced_at: timestamp
            }]);
            
            if (upsertError) {
              console.error(`❌ Database Error for match ${matchId}:`, upsertError.message);
            } else {
              console.log(`✅ Upserted scorecard for match ${matchId}`);
            }
          } else {
            console.error(`❌ Scraper failed for match ${matchId}: ${detailRes.data.error || 'Unknown error'}`);
          }
          // Small delay to be polite to CricHeroes
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err) {
          console.error(`Failed to deep sync match ${matchId}:`, err.message);
        }
      }
    }

    if (teams?.length) {
      const teamData = teams.map(t => ({
        id: t.team_id || t.id,
        data: t,
        synced_at: timestamp
      }));
      const { error: teamError } = await supabase.from('ch_teams_cache').upsert(teamData);
      if (teamError) console.error('Team Upsert Error:', teamError);
      else console.log(`Upserted ${teamData.length} teams.`);
    }

    const leaderboardData = leaderboard?.length ? leaderboard : standings;

    if (leaderboardData?.length) {
      const { error: standError } = await supabase.from('ch_leaderboard_cache').upsert([{ 
        id: 1, 
        data: leaderboardData, 
        synced_at: timestamp 
      }]);
      if (standError) console.error('Leaderboard Upsert Error:', standError);
      else console.log(`Upserted leaderboard (${leaderboardData.length} items).`);
    }

    console.log('Sync completed successfully at', timestamp);
  } catch (error) {
    if (error.response) {
      console.error('Sync Job Error (Response):', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('Sync Job Error (No Response): Scraper might be down at', SCRAPER_URL);
    } else {
      console.error('Sync Job Error (Setup):', error.message);
    }
  }
};

// Schedule: Every 15 minutes
cron.schedule('*/15 * * * *', syncData);

// Run immediately on start
syncData();
