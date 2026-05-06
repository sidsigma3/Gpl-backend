import axios from 'axios';

// LiteLLM proxy. AI_GATEWAY_URL points at the deployed proxy
// (Render web service). Falls back to localhost:4000 for dev.
const GATEWAY_URL = (process.env.AI_GATEWAY_URL || 'http://localhost:4000').replace(/\/+$/, '');
const GATEWAY_KEY = process.env.AI_GATEWAY_KEY || '';

const PRIMARY_MODEL = process.env.AI_GATEWAY_MODEL || 'gemini';

const callGateway = async (messages, { model, temperature = 0.4, jsonMode = false, maxTokens } = {}) => {
  const body = {
    model: model || PRIMARY_MODEL,
    messages,
    temperature,
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
  };
  const headers = { 'Content-Type': 'application/json' };
  if (GATEWAY_KEY) headers.Authorization = `Bearer ${GATEWAY_KEY}`;

  const res = await axios.post(`${GATEWAY_URL}/chat/completions`, body, {
    headers,
    timeout: 25_000,
  });
  return res.data?.choices?.[0]?.message?.content || '';
};

const safeJsonExtract = (text) => {
  if (!text) return null;
  try { return JSON.parse(text); } catch { /* fall through */ }
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
};

const buildMatchSnapshot = (matchData, details) => {
  const summary = details?.summary?.summaryData?.data
    || details?.scorecard?.miniScorecard?.data
    || matchData;
  if (!summary) return null;

  const teamA = summary.team_a;
  const teamB = summary.team_b;
  const aIn = (typeof teamA === 'object' ? teamA?.innings?.[0] : null) || matchData?.team_a_innings?.[0];
  const bIn = (typeof teamB === 'object' ? teamB?.innings?.[0] : null) || matchData?.team_b_innings?.[0];

  const recentOvers = summary.commentary_with_over_summary
    ?.slice(0, 5)
    .map(o => `Ov ${o.match_over_summary?.over}: ${o.match_over_summary?.run}r ${o.match_over_summary?.wicket || 0}w`)
    .join(', ');

  return {
    teamAName: (typeof teamA === 'object' ? teamA?.name : teamA) || matchData?.team_a,
    teamBName: (typeof teamB === 'object' ? teamB?.name : teamB) || matchData?.team_b,
    teamAScore: (typeof teamA === 'object' ? teamA?.summary : null) || matchData?.team_a_summary || 'Yet to bat',
    teamBScore: (typeof teamB === 'object' ? teamB?.summary : null) || matchData?.team_b_summary || 'Yet to bat',
    totalOvers: summary.overs || matchData?.overs,
    currentInning: summary.current_inning || summary.match_inning,
    target: summary.match_summary?.target,
    rrr: summary.match_summary?.rrr,
    toss: summary.toss_details || matchData?.toss_details,
    aRuns: aIn?.total_run, aWkts: aIn?.total_wicket, aOvers: aIn?.overs_played,
    bRuns: bIn?.total_run, bWkts: bIn?.total_wicket, bOvers: bIn?.overs_played,
    recentOvers,
    status: summary.status || matchData?.status,
    winner: summary.winning_team || matchData?.winning_team,
    winBy: summary.win_by || matchData?.win_by,
  };
};

export const generateCommentary = async (matchData, details = null) => {
  const snap = buildMatchSnapshot(matchData, details);
  if (!snap) return 'Match data unavailable.';

  const prompt = `You are a cricket commentator for the Govindpally Premier League (GPL).
Write a 3-sentence high-energy update for fans.

Teams: ${snap.teamAName} vs ${snap.teamBName}
Score: ${snap.teamAName} ${snap.teamAScore}, ${snap.teamBName} ${snap.teamBScore}
Format: ${snap.totalOvers} overs, currently inning ${snap.currentInning || '?'}.
${snap.toss ? `Toss: ${snap.toss}.` : ''}
${snap.recentOvers ? `Recent overs: ${snap.recentOvers}.` : ''}
${snap.target ? `Target: ${snap.target}, RRR: ${snap.rrr}.` : ''}
${snap.status === 'past' ? `Result: ${snap.winner} won by ${snap.winBy}.` : ''}

Respond with the commentary text only — no preamble, no markdown.`;

  try {
    return await callGateway(
      [{ role: 'user', content: prompt }],
      { temperature: 0.7, maxTokens: 200 },
    );
  } catch (err) {
    console.error('Commentary error:', err.response?.data?.error || err.message);
    return `${snap.teamAName} face off against ${snap.teamBName} at Govindapally — the action is heating up.`;
  }
};

export const calculateWinProbability = async (matchData, details = null) => {
  const snap = buildMatchSnapshot(matchData, details);
  if (!snap) return { team_a_pct: 50, team_b_pct: 50, analysis: 'Awaiting match data.' };

  // Past matches: deterministic, no LLM call needed.
  if (snap.status === 'past' && snap.winner) {
    const aWon = snap.winner === snap.teamAName;
    return {
      team_a_pct: aWon ? 100 : 0,
      team_b_pct: aWon ? 0 : 100,
      analysis: `${snap.winner} won by ${snap.winBy}.`,
    };
  }

  const prompt = `You are a cricket analyst. Estimate live win probability for both teams.

Match: ${snap.teamAName} vs ${snap.teamBName}, ${snap.totalOvers}-over match.
${snap.toss ? `Toss: ${snap.toss}.` : ''}
${snap.teamAName}: ${snap.teamAScore}${snap.aOvers ? ` in ${snap.aOvers} overs` : ''}.
${snap.teamBName}: ${snap.teamBScore}${snap.bOvers ? ` in ${snap.bOvers} overs` : ''}.
Current inning: ${snap.currentInning || 1}.
${snap.target ? `Target: ${snap.target}. Required run rate: ${snap.rrr}.` : 'First innings in progress.'}
${snap.recentOvers ? `Recent overs: ${snap.recentOvers}.` : ''}

Reply with ONLY this JSON (no prose, no markdown):
{"team_a_pct": <0-100 integer>, "team_b_pct": <0-100 integer>, "analysis": "<10-15 word reasoning>"}
Probabilities must sum to 100.`;

  try {
    const text = await callGateway(
      [{ role: 'user', content: prompt }],
      { temperature: 0.2, maxTokens: 150, jsonMode: true },
    );
    const parsed = safeJsonExtract(text);
    if (!parsed || typeof parsed.team_a_pct !== 'number' || typeof parsed.team_b_pct !== 'number') {
      throw new Error('Malformed AI response');
    }
    // Normalise so they sum to 100 even if the model is off.
    const sum = parsed.team_a_pct + parsed.team_b_pct;
    if (sum > 0 && sum !== 100) {
      parsed.team_a_pct = Math.round((parsed.team_a_pct / sum) * 100);
      parsed.team_b_pct = 100 - parsed.team_a_pct;
    }
    return parsed;
  } catch (err) {
    console.error('Probability error:', err.response?.data?.error || err.message);
    return { team_a_pct: 50, team_b_pct: 50, analysis: 'Match is finely poised.' };
  }
};
