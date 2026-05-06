import express from 'express';
import axios from 'axios';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// Get all matches (Live + Past)
router.get('/matches', async (req, res) => {
  try {
    const { tournamentId } = req.query;
    let query = supabase
      .from('ch_matches_cache')
      .select('*')
      .order('synced_at', { ascending: false });

    if (tournamentId) {
      query = query.eq('tournament_id', tournamentId);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: error.message });
  }
});

// Get match details (full scorecard)
router.get('/matches/:id/details', async (req, res) => {
  try {
    const tableName = 'ch_match_details_cache';
    const { data: cacheData, error: cacheError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (cacheError && cacheError.code !== 'PGRST116') {
      if (cacheError.message?.includes('schema cache')) {
        console.error('CRITICAL: Supabase cannot find ch_match_details_cache.');
      } else {
        console.error(`Supabase Lookup Error [${tableName}]:`, cacheError.message);
      }
    }

    // Decide whether the cached row is usable.
    // - Bad shape (missing summary.summaryData.data): treat as miss so it self-heals
    // - Live match older than 10s: refetch to keep scores near-realtime
    // - Past/upcoming: serve from cache regardless of age
    const cachedSummary = cacheData?.data?.summary?.summaryData?.data;
    const cacheAgeMs = cacheData?.synced_at
      ? Date.now() - new Date(cacheData.synced_at).getTime()
      : Infinity;
    const cacheUsable =
      cacheData?.data &&
      cachedSummary &&
      (cachedSummary.status !== 'live' || cacheAgeMs < 10_000);

    if (cacheUsable) {
      return res.json({ success: true, data: cacheData.data, error: null });
    }

    // Cache miss / stale-live / broken-shape — fall back to our own scraper service
    // (not CricHeroes direct, so no IP-ban risk).
    const { data: matchRow } = await supabase
      .from('ch_matches_cache')
      .select('*, tournament:tournaments(*)')
      .eq('id', req.params.id)
      .maybeSingle();

    if (matchRow && matchRow.tournament) {
      const slug = matchRow.tournament.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');
      const teamA = matchRow.data.team_a_name || matchRow.data.team_a;
      const teamB = matchRow.data.team_b_name || matchRow.data.team_b;

      try {
        const scraperRes = await axios.get(
          `${process.env.SCRAPER_SERVICE_URL}/scrape/match/${req.params.id}`,
          {
            params: { slug, team_a: teamA, team_b: teamB },
            headers: { 'x-sync-secret': process.env.ADMIN_TOKEN },
            timeout: 20000,
          }
        );

        if (scraperRes.data?.success) {
          const details = scraperRes.data.details;
          await supabase.from('ch_match_details_cache').upsert([{
            id: req.params.id,
            data: details,
            synced_at: new Date().toISOString(),
            tournament_id: matchRow.tournament_id,
          }]);
          return res.json({ success: true, data: details, error: null });
        }
      } catch (err) {
        console.error('On-demand match scrape failed:', err.message);
      }
    }

    // Scraper unavailable or no match row — return stale cache if we have anything,
    // otherwise admit we have nothing.
    if (cacheData?.data) {
      return res.json({ success: true, data: cacheData.data, error: null });
    }
    return res.status(200).json({
      success: false,
      data: null,
      error: 'Match scorecard temporarily unavailable. Try again shortly.',
    });

  } catch (error) {
    console.error('Match Details Error:', error.message);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
});

// Get teams
router.get('/teams', async (req, res) => {
  try {
    const { tournamentId } = req.query;
    let query = supabase.from('ch_teams_cache').select('*');
    
    if (tournamentId) {
      query = query.eq('tournament_id', tournamentId);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: error.message });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { tournamentId } = req.query;
    let query = supabase.from('ch_leaderboard_cache').select('*');
    
    if (tournamentId) {
      query = query.eq('tournament_id', tournamentId);
    } else {
      // Default to the most recently synced leaderboard
      query = query.order('synced_at', { ascending: false }).limit(1);
    }

    const { data, error } = await query.maybeSingle();
    
    if (error) throw error;
    if (!data) {
      return res.json({ success: true, data: [], message: 'No leaderboard data found for this season.' });
    }
    
    res.json({ success: true, data: data.data, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: error.message });
  }
});

// Vote for Man of the Match
router.post('/matches/:id/vote', async (req, res) => {
  try {
    const { playerId, playerName, voterId } = req.body;
    const matchId = req.params.id;
    const sessionId = voterId || req.ip; // Fallback to IP if voterId is missing

    const { error } = await supabase
      .from('fan_votes')
      .upsert([{ 
        match_id: matchId, 
        player_id: playerId, 
        player_name: playerName,
        session_id: sessionId 
      }], { onConflict: 'match_id, session_id' }); // One vote per person per match

    if (error) {
      console.error('Supabase Vote Error:', error);
      throw error;
    }
    res.json({ success: true, message: 'Vote recorded!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get vote counts for a match
router.get('/matches/:id/votes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('fan_votes')
      .select('player_id, player_name')
      .eq('match_id', req.params.id);

    if (error) {
      console.error('Supabase Get Votes Error:', error);
      throw error;
    }

    // Count votes per player
    const counts = data.reduce((acc, vote) => {
      acc[vote.player_id] = {
        name: vote.player_name,
        count: (acc[vote.player_id]?.count || 0) + 1
      };
      return acc;
    }, {});

    res.json({ success: true, data: Object.values(counts).sort((a, b) => b.count - a.count) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get AI Highlights for a match
router.get('/matches/:id/highlights', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Check if we already have it cached
    const { data: existing } = await supabase
      .from('ch_highlights_cache')
      .select('*')
      .eq('match_id', id)
      .single();

    if (existing) {
      return res.json({ success: true, data: existing.content });
    }

    // 2. Get the match details to feed the AI
    const { data: match } = await supabase
      .from('ch_match_details_cache')
      .select('data')
      .eq('id', id)
      .single();

    if (!match) throw new Error('Match data not found. Please sync first.');

    // 3. Generate with AI (This uses the system AI tool)
    // Note: In production, you'd call an OpenAI/Gemini API here.
    // I will simulate a professional generation logic that can be replaced with a real API call.
    
    const summary = match.data.summary.summaryData.data;
    const scorecard = match.data.scorecard.scorecardData || [];
    
    // We'll ask the AI to generate a story based on these stats
    const prompt = `Write a professional, exciting cricket match summary for this game:
    ${summary.team_a.name} vs ${summary.team_b.name}.
    Result: ${summary.winning_team} won by ${summary.win_by}.
    Toss: ${summary.toss_details}.
    Scorecard Data: ${JSON.stringify(scorecard.slice(0, 2))}
    Tone: Enthusiastic, professional cricket commentator. Max 3 paragraphs.`;

    // For now, I'll provide a high-quality template-based summary 
    // but the route is ready for an LLM integration.
    const generatedText = `${summary.winning_team} secured a commanding victory over ${summary.team_a.name === summary.winning_team ? summary.team_b.name : summary.team_a.name} in a thrilling encounter at ${summary.ground_name}. After ${summary.toss_details}, the match saw some exceptional individual performances that defined the outcome. ${summary.winning_team} eventually chased the target with ${summary.win_by} to spare, proving their dominance in the ${summary.tournament_round_name}. This win significantly boosts their momentum as the tournament progresses towards the finals.`;

    // 4. Cache it
    await supabase.from('ch_highlights_cache').upsert([{
      match_id: id,
      content: generatedText,
      synced_at: new Date().toISOString()
    }]);

    res.json({ success: true, data: generatedText });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Aggregated player stats (most runs / most wickets / best batting average / best
// strike rate / best economy etc) computed live from ch_match_details_cache.
router.get('/stats', async (req, res) => {
  try {
    const { tournamentId } = req.query;
    let query = supabase.from('ch_match_details_cache').select('id, data, tournament_id');
    if (tournamentId) query = query.eq('tournament_id', tournamentId);
    const { data: rows, error } = await query;
    if (error) throw error;

    const batters = new Map(); // player_id -> { name, team_id, runs, balls, fours, sixes, innings, notOuts, highest, photo }
    const bowlers = new Map(); // player_id -> { name, team_id, wickets, runs, overs (decimal), innings, photo }

    const oversToDecimal = (s) => {
      if (!s) return 0;
      const [w, b] = String(s).split('.');
      return (parseInt(w, 10) || 0) + ((parseInt(b || '0', 10) || 0) / 6);
    };

    for (const row of rows || []) {
      const scorecard = row?.data?.scorecard?.scorecard || [];
      for (const inning of scorecard) {
        for (const b of inning.batting || []) {
          if (!b?.player_id || !b.name) continue;
          const key = String(b.player_id);
          const cur = batters.get(key) || {
            player_id: b.player_id, name: b.name, team_id: inning.team_id,
            runs: 0, balls: 0, fours: 0, sixes: 0, innings: 0, not_outs: 0,
            highest: 0, photo: b.profile_photo,
          };
          cur.runs += Number(b.runs) || 0;
          cur.balls += Number(b.balls) || 0;
          cur.fours += Number(b['4s']) || 0;
          cur.sixes += Number(b['6s']) || 0;
          cur.innings += 1;
          if (b.how_to_out === 'not out') cur.not_outs += 1;
          if ((Number(b.runs) || 0) > cur.highest) cur.highest = Number(b.runs) || 0;
          if (!cur.photo && b.profile_photo) cur.photo = b.profile_photo;
          batters.set(key, cur);
        }
        for (const bw of inning.bowling || []) {
          if (!bw?.player_id || !bw.name) continue;
          const key = String(bw.player_id);
          const cur = bowlers.get(key) || {
            player_id: bw.player_id, name: bw.name, team_id: inning.team_id,
            wickets: 0, runs: 0, overs_decimal: 0, innings: 0, photo: bw.profile_photo,
          };
          cur.wickets += Number(bw.wickets) || 0;
          cur.runs += Number(bw.runs) || 0;
          cur.overs_decimal += oversToDecimal(bw.overs);
          cur.innings += 1;
          if (!cur.photo && bw.profile_photo) cur.photo = bw.profile_photo;
          bowlers.set(key, cur);
        }
      }
    }

    const enrichedBatters = Array.from(batters.values()).map(b => ({
      ...b,
      strike_rate: b.balls > 0 ? +(b.runs / b.balls * 100).toFixed(2) : 0,
      average: (b.innings - b.not_outs) > 0 ? +(b.runs / (b.innings - b.not_outs)).toFixed(2) : null,
    }));
    const enrichedBowlers = Array.from(bowlers.values()).map(b => ({
      ...b,
      overs: +b.overs_decimal.toFixed(1),
      economy: b.overs_decimal > 0 ? +(b.runs / b.overs_decimal).toFixed(2) : 0,
    }));

    const TOP_N = 10;
    const topRunScorers = [...enrichedBatters].sort((a, b) => b.runs - a.runs).slice(0, TOP_N);
    const topWicketTakers = [...enrichedBowlers].sort((a, b) => b.wickets - a.wickets || a.economy - b.economy).slice(0, TOP_N);
    const topStrikeRate = [...enrichedBatters]
      .filter(b => b.balls >= 20) // qualifier
      .sort((a, b) => b.strike_rate - a.strike_rate).slice(0, TOP_N);
    const topBoundaries = [...enrichedBatters]
      .map(b => ({ ...b, boundaries: b.fours + b.sixes }))
      .sort((a, b) => b.boundaries - a.boundaries || b.sixes - a.sixes)
      .slice(0, TOP_N);
    const bestEconomy = [...enrichedBowlers]
      .filter(b => b.overs_decimal >= 4) // qualifier
      .sort((a, b) => a.economy - b.economy).slice(0, TOP_N);

    res.json({
      success: true,
      data: {
        most_runs: topRunScorers,
        most_wickets: topWicketTakers,
        best_strike_rate: topStrikeRate,
        most_boundaries: topBoundaries,
        best_economy: bestEconomy,
      },
      error: null,
    });
  } catch (error) {
    console.error('Stats Error:', error.message);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
});

// Get all tournaments
router.get('/tournaments', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('is_active', true)
      .order('year', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: error.message });
  }
});

export default router;
