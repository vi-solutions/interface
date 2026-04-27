-- 021_milestones_date.sql
-- Milestones: replace boolean completed flag with a specific date
ALTER TABLE milestones DROP COLUMN IF EXISTS completed;
ALTER TABLE milestones ADD COLUMN date DATE;
