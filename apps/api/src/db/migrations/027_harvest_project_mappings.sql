CREATE TABLE harvest_project_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  harvest_project_id TEXT NOT NULL UNIQUE,
  harvest_project_name TEXT NOT NULL DEFAULT '',
  app_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
