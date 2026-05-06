import express from 'express';
import { supabase } from '../lib/supabase.js';
import { generateCommentary, calculateWinProbability } from '../services/aiService.js';

const router = express.Router();

// We piggyback the existing ch_match_details_cache row's `ai_insight` JSON
// column instead of a new table — same lifecycle as the scorecard cache,
// so a fresh deep-sync naturally invalidates stale insights too.
//
// Insights regenerate when:
//   - cache row has no ai_insight at all
//   - the latest commentary ball_id has advanced (a new ball was scored)
//   - the cached insight is older than 90s (safety net for matches whose
//     scorecard isn't ticking but insight was generated under stale data)
const STALE_INSIGHT_MS = 90_000;

function latestBallId(details) {
  const src =
    details?.commentary?.miniScorecard?.data ||
    details?.scorecard?.miniScorecard?.data ||
    details?.summary?.summaryData?.data;
  return src?.commentary?.[0]?.ball_id ?? null;
}

router.get('/match-insight/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;

    // 1. Load match-list row (lightweight summary fields used as fallback).
    const { data: matchRow } = await supabase
      .from('ch_matches_cache')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();

    if (!matchRow) {
      return res.status(404).json({ error: 'Match not found in cache' });
    }
    const matchData = matchRow.data;

    // 2. Load detailed cache (scorecard, commentary, etc.) if available.
    const { data: detailsRow } = await supabase
      .from('ch_match_details_cache')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();
    const details = detailsRow?.data || null;

    const ballId = latestBallId(details);
    const cached = detailsRow?.ai_insight || null;
    const cachedAt = cached?.updated_at ? new Date(cached.updated_at).getTime() : 0;
    const ageMs = cachedAt ? Date.now() - cachedAt : Infinity;

    const isPast = matchData?.status === 'past';
    const cacheStillFresh =
      cached &&
      cached.ball_id === ballId &&
      (isPast || ageMs < STALE_INSIGHT_MS);

    if (cacheStillFresh) {
      return res.json({
        match_id: matchId,
        commentary: cached.commentary,
        probability: cached.probability,
        updated_at: cached.updated_at,
        cached: true,
      });
    }

    // 3. Generate fresh insights via the LiteLLM gateway.
    const [commentary, probability] = await Promise.all([
      generateCommentary(matchData, details),
      calculateWinProbability(matchData, details),
    ]);
    const updatedAt = new Date().toISOString();
    const insight = { ball_id: ballId, commentary, probability, updated_at: updatedAt };

    // 4. Persist back onto the details row when we have one. If the details row
    //    doesn't exist yet, skip the write — the next deep-sync will create it.
    if (detailsRow) {
      const { error: updateErr } = await supabase
        .from('ch_match_details_cache')
        .update({ ai_insight: insight })
        .eq('id', matchId);
      if (updateErr) console.error('Insight cache write failed:', updateErr.message);
    }

    res.json({
      match_id: matchId,
      commentary,
      probability,
      updated_at: updatedAt,
      cached: false,
    });
  } catch (error) {
    console.error('AI Route Error:', error.message);
    res.status(500).json({ error: 'Failed to generate AI insights' });
  }
});

export default router;
