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
    stream: false,
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
  };
  const headers = { 'Content-Type': 'application/json' };
  if (GATEWAY_KEY) headers.Authorization = `Bearer ${GATEWAY_KEY}`;

  const res = await axios.post(`${GATEWAY_URL}/chat/completions`, body, {
    headers,
    timeout: 25_000,
  });
  const choice = res.data?.choices?.[0] || {};
  const content = choice.message?.content || '';
  const finishReason = choice.finish_reason;
  const usedModel = res.data?.model;
  return { content, finishReason, usedModel };
};

const safeJsonExtract = (text) => {
  if (!text) return null;
  try { return JSON.parse(text); } catch { /* fall through */ }
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
};

const oversToDecimal = (s) => {
  if (s === null || s === undefined) return 0;
  const str = String(s);
  const [w, b] = str.split('.');
  return (parseInt(w, 10) || 0) + ((parseInt(b || '0', 10) || 0) / 6);
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
    totalOvers: Number(summary.overs || matchData?.overs) || 0,
    currentInning: summary.current_inning || summary.match_inning,
    target: Number(summary.match_summary?.target) || null,
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

// Deterministic baseline used (a) when we can't reach the LLM, and (b) as
// a sanity-check seed. For tennis-ball village cricket par RR is around 10.
function baselineProbability(snap) {
  // Defaults
  let aPct = 50;
  let analysis = 'Match is finely poised.';

  // Finished matches: 100/0 from the recorded result.
  if (snap.status === 'past' && snap.winner) {
    const aWon = snap.winner === snap.teamAName;
    return {
      team_a_pct: aWon ? 100 : 0,
      team_b_pct: aWon ? 0 : 100,
      analysis: `${snap.winner} won by ${snap.winBy}.`,
    };
  }

  // Second innings — proper chase math.
  if (snap.currentInning === 2 && snap.target && snap.totalOvers > 0) {
    const target = snap.target;
    const bRuns = snap.bRuns || 0;
    const bWkts = snap.bWkts || 0;
    const bOversDec = oversToDecimal(snap.bOvers);
    const oversRemaining = Math.max(0, snap.totalOvers - bOversDec);
    const ballsRemaining = Math.round(oversRemaining * 6);
    const wicketsInHand = Math.max(0, 10 - bWkts);
    const runsNeeded = Math.max(0, target - bRuns);
    const reqRR = oversRemaining > 0 ? runsNeeded / oversRemaining : Infinity;

    if (runsNeeded <= 0) {
      return { team_a_pct: 0, team_b_pct: 100, analysis: `${snap.teamBName} chased it down.` };
    }
    if (wicketsInHand <= 0 || ballsRemaining <= 0) {
      return { team_a_pct: 100, team_b_pct: 0, analysis: `${snap.teamAName} held on by ${runsNeeded} runs.` };
    }

    // Required-RR vs achievable. Tennis-ball par ~10, hard >14, very hard >18.
    let bChasePct;
    if (reqRR < 6)        bChasePct = 88;
    else if (reqRR < 8)   bChasePct = 78;
    else if (reqRR < 10)  bChasePct = 65;
    else if (reqRR < 12)  bChasePct = 50;
    else if (reqRR < 14)  bChasePct = 38;
    else if (reqRR < 18)  bChasePct = 22;
    else                  bChasePct = 10;

    // Wickets-in-hand modifier.
    if (wicketsInHand <= 2)      bChasePct = Math.max(5, bChasePct - 25);
    else if (wicketsInHand <= 4) bChasePct = Math.max(8, bChasePct - 12);
    else if (wicketsInHand >= 8) bChasePct = Math.min(95, bChasePct + 5);

    aPct = 100 - bChasePct;
    analysis = `${snap.teamBName} need ${runsNeeded} from ${ballsRemaining} balls, ${wicketsInHand} wkts in hand.`;
  }

  // First innings — soft signal from runs/wickets vs typical par.
  else if (snap.currentInning === 1 && snap.aRuns !== undefined && snap.totalOvers > 0) {
    const aOversDec = oversToDecimal(snap.aOvers);
    const wicketsInHand = Math.max(0, 10 - (snap.aWkts || 0));
    const projected = aOversDec > 0 ? (snap.aRuns / aOversDec) * snap.totalOvers : 0;
    const par = snap.totalOvers * 10;

    aPct = 50;
    if (projected >= par + 30) aPct += 12;
    else if (projected >= par + 10) aPct += 6;
    else if (projected <= par - 30) aPct -= 12;
    else if (projected <= par - 10) aPct -= 6;

    if (wicketsInHand <= 3) aPct -= 8;
    else if (wicketsInHand >= 8) aPct += 3;

    aPct = Math.max(20, Math.min(80, aPct));
    analysis = `${snap.teamAName} ${snap.aRuns}/${snap.aWkts || 0} after ${snap.aOvers || 0} overs — projected ${Math.round(projected)}.`;
  }

  return {
    team_a_pct: Math.round(aPct),
    team_b_pct: 100 - Math.round(aPct),
    analysis,
  };
}

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

Respond with the commentary text only — no preamble, no markdown. 2-3 sentences.`;

  try {
    const { content, finishReason, usedModel } = await callGateway(
      [{ role: 'user', content: prompt }],
      { temperature: 0.7, maxTokens: 350 },
    );
    if (finishReason && finishReason !== 'stop' && finishReason !== 'length') {
      console.warn(`Commentary finished with reason="${finishReason}" model=${usedModel} len=${content?.length}`);
    }
    return content?.trim() || `${snap.teamAName} face off against ${snap.teamBName} at Govindapally — the action is heating up.`;
  } catch (err) {
    console.error('Commentary error:', err.response?.data?.error || err.message);
    return `${snap.teamAName} face off against ${snap.teamBName} at Govindapally — the action is heating up.`;
  }
};

export const calculateWinProbability = async (matchData, details = null) => {
  const snap = buildMatchSnapshot(matchData, details);
  if (!snap) return { team_a_pct: 50, team_b_pct: 50, analysis: 'Awaiting match data.' };

  // Always start from a deterministic baseline. This guarantees a meaningful
  // bar even when the LLM is unreachable, returns malformed JSON, or is
  // rate-limited. The LLM call below only refines this.
  const baseline = baselineProbability(snap);

  // Past matches: skip the LLM entirely — baseline is already the truth.
  if (snap.status === 'past') return { ...baseline, source: 'final' };

  // No useful match state yet (toss done, no balls bowled): just hand back the
  // baseline rather than ask the LLM to hallucinate.
  if (!snap.aRuns && !snap.bRuns) {
    return {
      ...baseline,
      analysis: snap.toss ? `${snap.toss}. Match underway.` : 'Match underway.',
      source: 'baseline',
    };
  }

  const prompt = `You are a cricket analyst for the Govindpally Premier League (a tennis-ball village tournament where par run-rate is around 10).

Match state:
- ${snap.teamAName} vs ${snap.teamBName}, ${snap.totalOvers}-over match.
- ${snap.toss || ''}
- ${snap.teamAName}: ${snap.teamAScore}${snap.aOvers ? ` in ${snap.aOvers} overs` : ''}.
- ${snap.teamBName}: ${snap.teamBScore}${snap.bOvers ? ` in ${snap.bOvers} overs` : ''}.
- Current inning: ${snap.currentInning || 1}.
- ${snap.target ? `Target: ${snap.target}. Required run rate: ${snap.rrr}.` : 'First innings in progress.'}
- ${snap.recentOvers ? `Recent overs: ${snap.recentOvers}.` : ''}
- A simple model estimates ${snap.teamAName} ~${baseline.team_a_pct}% / ${snap.teamBName} ~${baseline.team_b_pct}%. You may adjust this.

Output a single JSON object on one line, nothing else:
{"team_a_pct": <integer 0-100>, "team_b_pct": <integer 0-100>, "analysis": "<one short sentence, 12-18 words>"}
Probabilities must sum to 100.`;

  try {
    const { content, finishReason, usedModel } = await callGateway(
      [{ role: 'user', content: prompt }],
      { temperature: 0.3, maxTokens: 300 }, // jsonMode dropped — too unreliable across free models
    );

    const parsed = safeJsonExtract(content);
    if (!parsed
        || typeof parsed.team_a_pct !== 'number'
        || typeof parsed.team_b_pct !== 'number'
        || (parsed.team_a_pct + parsed.team_b_pct) === 0) {
      console.warn(
        `Probability: malformed LLM response — model=${usedModel} finish=${finishReason} len=${content?.length}\nRaw: ${String(content).slice(0, 400)}`,
      );
      return { ...baseline, source: 'baseline-llm-malformed', model: usedModel || PRIMARY_MODEL };
    }

    // Normalise to 100 in case the model rounded.
    const sum = parsed.team_a_pct + parsed.team_b_pct;
    if (sum !== 100) {
      parsed.team_a_pct = Math.round((parsed.team_a_pct / sum) * 100);
      parsed.team_b_pct = 100 - parsed.team_a_pct;
    }
    if (typeof parsed.analysis !== 'string' || !parsed.analysis.trim()) {
      parsed.analysis = baseline.analysis;
    }
    return { ...parsed, source: 'llm', model: usedModel || PRIMARY_MODEL };
  } catch (err) {
    console.error('Probability error:', err.response?.data?.error || err.message);
    return { ...baseline, source: 'baseline-llm-error' };
  }
};
