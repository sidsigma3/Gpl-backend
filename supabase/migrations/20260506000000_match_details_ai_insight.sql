-- Adds an ai_insight JSONB column to ch_match_details_cache so the AI route
-- can persist generated commentary + win probability and only call the LLM
-- when the underlying ball state advances.

ALTER TABLE ch_match_details_cache
  ADD COLUMN IF NOT EXISTS ai_insight JSONB;
