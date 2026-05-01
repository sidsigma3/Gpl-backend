import express from 'express';
import { supabase } from '../lib/supabase.js';
import { generateCommentary, calculateWinProbability } from '../services/aiService.js';

const router = express.Router();

router.get('/match-insight/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;

    // 1. Fetch match data from cache
    const { data: match, error } = await supabase
      .from('ch_matches_cache')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();

    if (error || !match) {
      return res.status(404).json({ error: 'Match data not found' });
    }

    const matchData = match.data;

    // 2. Generate AI insights in parallel
    const [commentary, probability] = await Promise.all([
      generateCommentary(matchData),
      calculateWinProbability(matchData)
    ]);

    res.json({
      match_id: matchId,
      commentary,
      probability,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI Route Error:', error.message);
    res.status(500).json({ error: 'Failed to generate AI insights' });
  }
});

export default router;
