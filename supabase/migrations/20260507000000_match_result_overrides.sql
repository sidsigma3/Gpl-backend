-- Tournament committees sometimes award points off-field (abandoned matches,
-- forfeits, disputed results). CricHeroes does not reflect these decisions in
-- its scorecard, so we keep an overrides table here. Standings and team detail
-- read this and apply the override on top of whatever CricHeroes returned.
--
-- result_type:
--   'win'        - winning_team_name took the points (2 pts)
--   'tie'        - 1 point each
--   'no_result'  - 1 point each (e.g., washout)

CREATE TABLE IF NOT EXISTS match_result_overrides (
  match_id BIGINT PRIMARY KEY,
  winning_team_name TEXT,
  result_type TEXT NOT NULL DEFAULT 'win',
  win_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT match_result_overrides_result_type_check
    CHECK (result_type IN ('win', 'tie', 'no_result'))
);
