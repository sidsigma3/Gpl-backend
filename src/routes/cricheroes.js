import express from 'express';
import axios from 'axios';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// Get all matches (Live + Past)
router.get('/matches', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ch_matches_cache')
      .select('*')
      .order('synced_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: error.message });
  }
});

// Get match details (full scorecard)
router.get('/matches/:id/details', async (req, res) => {
  try {
    // 1. Check cache first
    const { data: cacheData, error: cacheError } = await supabase
      .from('ch_match_details_cache')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (cacheData && !req.query.refresh) {
      return res.json({ success: true, data: cacheData.data, error: null });
    }

    // 2. Not in cache or refresh requested, fetch from match cache to get teams
    const { data: match, error: matchError } = await supabase
      .from('ch_matches_cache')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (matchError || !match) throw new Error('Match not found');

    const m = match.data;
    const { data: settings } = await supabase.from('tournament_settings').select('*').single();
    const slug = settings.cricheroes_id === '1499216' 
      ? 'govindaplly-premier-leauge-2' 
      : settings.name?.toLowerCase().replace(/ /g, '-');

    // 3. Fetch from scraper
    const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:8000';
    const SYNC_SECRET = process.env.ADMIN_TOKEN;

    const response = await axios.get(`${SCRAPER_URL}/scrape/match/${req.params.id}`, {
      params: { 
        slug,
        team_a: m.team_a,
        team_b: m.team_b
      },
      headers: { 'x-sync-secret': SYNC_SECRET }
    });

    if (response.data.success) {
      const details = response.data.details;
      // 4. Cache it
      await supabase.from('ch_match_details_cache').upsert([{
        id: req.params.id,
        data: details,
        synced_at: new Date().toISOString()
      }]);

      return res.json({ success: true, data: details, error: null });
    }

    throw new Error('Failed to fetch details from scraper');
  } catch (error) {
    const errorDetail = error.response?.data?.detail || error.message;
    console.error('Match Details Error:', errorDetail);
    res.status(500).json({ success: false, data: null, error: errorDetail });
  }
});

// Get teams
router.get('/teams', async (req, res) => {
  try {
    const { data, error } = await supabase.from('ch_teams_cache').select('*');
    if (error) throw error;
    res.json({ success: true, data, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: error.message });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { data, error } = await supabase.from('ch_leaderboard_cache').select('*').single();
    if (error) throw error;
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

export default router;
