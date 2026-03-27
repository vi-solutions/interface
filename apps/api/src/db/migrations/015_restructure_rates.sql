-- 015_restructure_rates.sql
-- Rates belong to users per project, not to time categories.
-- Each user on a project can have an hourly rate, a daily rate, or both.

-- Remove rate_cents from time categories (global and project-level)
ALTER TABLE time_categories DROP COLUMN rate_cents;
ALTER TABLE project_time_categories DROP COLUMN rate_cents;

-- Restructure project_user_rates: replace single rate_type/rate_cents with dual columns
ALTER TABLE project_user_rates ADD COLUMN hourly_rate_cents BIGINT DEFAULT NULL;
ALTER TABLE project_user_rates ADD COLUMN daily_rate_cents BIGINT DEFAULT NULL;

-- Migrate existing data before dropping old columns
UPDATE project_user_rates
  SET hourly_rate_cents = CASE WHEN rate_type = 'hourly' THEN rate_cents ELSE NULL END,
      daily_rate_cents  = CASE WHEN rate_type = 'daily'  THEN rate_cents ELSE NULL END;

ALTER TABLE project_user_rates DROP COLUMN rate_type;
ALTER TABLE project_user_rates DROP COLUMN rate_cents;
