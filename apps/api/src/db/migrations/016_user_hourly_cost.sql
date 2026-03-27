-- 016_user_hourly_cost.sql
-- Add hourly cost (wage) for users to calculate net profit on projects

ALTER TABLE users ADD COLUMN hourly_cost_cents BIGINT NOT NULL DEFAULT 0;
