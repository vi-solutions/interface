ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS status_before_archive TEXT;
