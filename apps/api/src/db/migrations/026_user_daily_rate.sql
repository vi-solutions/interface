-- 026_user_daily_rate.sql
-- Add a default daily rate to users (mirrors rate_cents which is the hourly rate).
ALTER TABLE users ADD COLUMN daily_rate_cents BIGINT NOT NULL DEFAULT 0;
