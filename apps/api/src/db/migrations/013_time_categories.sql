-- 013_time_categories.sql
-- Global time categories with default rates and per-project overrides

CREATE TABLE time_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  rate_cents      BIGINT NOT NULL DEFAULT 0,
  archived_at     TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE project_time_categories (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  time_category_id      UUID REFERENCES time_categories(id) ON DELETE CASCADE,
  name                  TEXT,
  description           TEXT,
  rate_cents            BIGINT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, time_category_id)
);

-- When time_category_id is set: inherited category with rate override
-- When time_category_id is null: project-specific custom category (name required)
ALTER TABLE project_time_categories ADD CONSTRAINT project_time_categories_custom_check
  CHECK (
    (time_category_id IS NOT NULL) OR
    (name IS NOT NULL)
  );

-- Link time entries to a project time category
ALTER TABLE time_entries ADD COLUMN project_time_category_id UUID REFERENCES project_time_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_time_categories_archived ON time_categories(archived_at);
CREATE INDEX idx_project_time_categories_project_id ON project_time_categories(project_id);
CREATE INDEX idx_project_time_categories_category_id ON project_time_categories(time_category_id);
CREATE INDEX idx_time_entries_project_time_category_id ON time_entries(project_time_category_id);
