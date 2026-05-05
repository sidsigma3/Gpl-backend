import cron from 'node-cron';
import axios from 'axios';
import { supabase } from '../lib/supabase.js';

const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL;
const SYNC_SECRET = process.env.ADMIN_TOKEN;

export const syncData = async () => {
  try {
    console.log('--- STARTING MULTI-TOURNAMENT SYNC ---');
    
    // 1. Get all active tournaments from the new table
    const { data: tournaments, error: tourneyError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('is_active', true);

    if (tourneyError) {
      console.error('Failed to fetch tournaments:', tourneyError.message);
      return;
    }

    if (!tournaments || tournaments.length === 0) {
      console.log('No active tournaments found to sync.');
      return;
    }

    for (const tournament of tournaments) {
      console.log(`\n🔄 Syncing Tournament: ${tournament.name} (${tournament.api_tournament_id})`);
      
      const cricheroesId = tournament.api_tournament_id;
      // Generate slug from name
      const slug = tournament.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');

      // 2. Call Python Scraper
      try {
        const response = await axios.get(`${SCRAPER_URL}/scrape/${cricheroesId}`, {
          params: { slug },
          headers: { 'x-sync-secret': SYNC_SECRET }
        });

        const { matches, teams, standings, leaderboard } = response.data;
        const timestamp = new Date().toISOString();

        console.log(`Scraped ${tournament.name}: ${matches?.length || 0} matches, ${teams?.length || 0} teams.`);
        
        // 3. Update Cache Tables with tournament_id
        if (matches?.length) {
          const matchData = matches.map(m => ({
            id: m.match_id || m.id,
            data: m,
            synced_at: timestamp,
            tournament_id: tournament.id
          }));
          await supabase.from('ch_matches_cache').upsert(matchData);
          console.log(`✅ Upserted ${matchData.length} matches for ${tournament.name}.`);

          // 4. DEEP SYNC: Match details
          for (const m of matches) {
            const matchId = m.match_id || m.id;
            
            // Skip deep sync for upcoming matches — no scorecard exists yet
            if (m.status === 'upcoming') continue;

            try {
              const detailRes = await axios.get(`${SCRAPER_URL}/scrape/match/${matchId}`, {
                params: { slug, team_a: m.team_a_name || m.team_a, team_b: m.team_b_name || m.team_b },
                headers: { 'x-sync-secret': SYNC_SECRET }
              });

              if (detailRes.data.success) {
                await supabase.from('ch_match_details_cache').upsert([{
                  id: matchId,
                  data: detailRes.data.details,
                  synced_at: timestamp,
                  tournament_id: tournament.id
                }]);
                console.log(`   └─ Cached scorecard: ${matchId}`);
              }
              await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (err) {
              console.error(`   └─ Failed match ${matchId}:`, err.message);
            }
          }
        }

        if (teams?.length) {
          for (const t of teams) {
            const teamId = t.team_id || t.id;
            
            await supabase.from('ch_teams_cache').upsert([{
              id: teamId,
              data: t,
              synced_at: timestamp,
              tournament_id: tournament.id
            }]);
          }
          console.log(`✅ Upserted ${teams.length} teams for ${tournament.name}.`);
        }

        const leaderboardData = leaderboard?.length ? leaderboard : standings;
        if (leaderboardData?.length) {
          // Find existing leaderboard for this tournament
          const { data: existing } = await supabase
            .from('ch_leaderboard_cache')
            .select('id')
            .eq('tournament_id', tournament.id)
            .maybeSingle();

          if (existing) {
            // Update existing
            await supabase.from('ch_leaderboard_cache')
              .update({ 
                data: leaderboardData, 
                synced_at: timestamp 
              })
              .eq('id', existing.id);
          } else {
            // Insert new
            await supabase.from('ch_leaderboard_cache').insert([{ 
              data: leaderboardData, 
              synced_at: timestamp,
              tournament_id: tournament.id
            }]);
          }
          console.log(`✅ Upserted leaderboard for ${tournament.name}.`);
        }

      } catch (err) {
        console.error(`❌ Sync failed for ${tournament.name}:`, err.message);
      }
    }

    console.log('\n--- ALL SYNC JOBS COMPLETE ---');
  } catch (error) {
    console.error('Critical Sync Error:', error.message);
  }
};

// Lightweight pass: refresh only currently-live matches, every 2 minutes.
// Hits the dedicated /scrape/live/{tournament_id} scraper endpoint which only
// fetches the live-matches tab (1 request) — cheap on Render free tier.
export const syncLiveMatches = async () => {
  try {
    const { data: tournaments, error: tourneyError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('is_active', true);

    if (tourneyError || !tournaments?.length) return;

    for (const tournament of tournaments) {
      const slug = tournament.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');

      try {
        const liveRes = await axios.get(
          `${SCRAPER_URL}/scrape/live/${tournament.api_tournament_id}`,
          { params: { slug }, headers: { 'x-sync-secret': SYNC_SECRET }, timeout: 15000 }
        );

        const liveMatches = liveRes.data?.matches || [];
        if (!liveMatches.length) continue;

        const timestamp = new Date().toISOString();
        console.log(`⚡ Live sync ${tournament.name}: ${liveMatches.length} live match(es)`);

        // Refresh ch_matches_cache rows for these live matches (so list views see fresh scores)
        await supabase.from('ch_matches_cache').upsert(
          liveMatches.map(m => ({
            id: m.match_id || m.id,
            data: m,
            synced_at: timestamp,
            tournament_id: tournament.id,
          }))
        );

        // Refresh the full scorecard for each live match
        for (const m of liveMatches) {
          const matchId = m.match_id || m.id;
          try {
            const detailRes = await axios.get(`${SCRAPER_URL}/scrape/match/${matchId}`, {
              params: { slug, team_a: m.team_a_name || m.team_a, team_b: m.team_b_name || m.team_b },
              headers: { 'x-sync-secret': SYNC_SECRET },
              timeout: 20000,
            });
            if (detailRes.data?.success) {
              await supabase.from('ch_match_details_cache').upsert([{
                id: matchId,
                data: detailRes.data.details,
                synced_at: timestamp,
                tournament_id: tournament.id,
              }]);
            }
          } catch (err) {
            console.error(`   └─ Live detail failed ${matchId}:`, err.message);
          }
        }
      } catch (err) {
        console.error(`❌ Live sync failed for ${tournament.name}:`, err.message);
      }
    }
  } catch (error) {
    console.error('Critical Live Sync Error:', error.message);
  }
};

// Full sync (matches + teams + leaderboard + all match scorecards): every 30 min
cron.schedule('*/30 * * * *', syncData);

// Live-only fast pass: every 2 min
cron.schedule('*/2 * * * *', syncLiveMatches);

// Run full sync immediately on start
syncData();
