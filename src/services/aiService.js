import axios from 'axios';

const GATEWAY_URL = 'http://localhost:4000/chat/completions';

/**
 * Generate professional cricket commentary using Tencent Hy3
 */
export const generateCommentary = async (matchData) => {
  try {
    const prompt = `
      You are a professional cricket commentator for the Govindpally Premier League (GPL).
      Based on the following match data, write a 3-sentence, high-energy, professional commentary update.
      Focus on the current momentum and key players. 
      Match: ${matchData.team_a} vs ${matchData.team_b}
      Current Score: ${matchData.team_a_summary || 'N/A'} vs ${matchData.team_b_summary || 'N/A'}
      Result/Status: ${matchData.match_summary?.summary || matchData.status}
      
      Respond only with the commentary text. No introductions.
    `;

    const response = await axios.post(GATEWAY_URL, {
      model: 'hy3',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Commentary Error:', error.message);
    return "The atmosphere is electric here at Govindpally as both teams battle for supremacy in this crucial GPL encounter!";
  }
};

/**
 * Calculate Win Probability using MiniMax M2.5
 */
export const calculateWinProbability = async (matchData) => {
  try {
    const prompt = `
      Analyze this cricket match state for Govindpally Premier League.
      Data: ${JSON.stringify(matchData)}
      Based on the scores, wickets, and match status, provide a win probability percentage for BOTH teams.
      Format your response exactly like this JSON: {"team_a_pct": 50, "team_b_pct": 50, "analysis": "brief 10 word reasoning"}
    `;

    const response = await axios.post(GATEWAY_URL, {
      model: 'minimax',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });

    const content = response.data.choices[0].message.content;
    return JSON.parse(content.match(/\{.*\}/s)[0]);
  } catch (error) {
    console.error('Probability Error:', error.message);
    return { team_a_pct: 50, team_b_pct: 50, analysis: "The match is dead even as we approach the final stages." };
  }
};
