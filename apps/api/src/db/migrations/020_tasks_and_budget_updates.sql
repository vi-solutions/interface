-- 020_tasks_and_budget_updates.sql
-- 1. Milestones: remove time budget, add completed flag (no longer linked to time entries)
ALTER TABLE milestones DROP COLUMN IF EXISTS budget_hours;
ALTER TABLE milestones ADD COLUMN completed BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Time entries: remove milestone and time-category links
ALTER TABLE time_entries DROP COLUMN IF EXISTS milestone_id;
ALTER TABLE time_entries DROP COLUMN IF EXISTS project_time_category_id;

-- 3. Projects: add hours budget alongside existing dollar budget
ALTER TABLE projects ADD COLUMN budget_hours NUMERIC(10,2);

-- 4. Project user rates: add per-employee budget fields
ALTER TABLE project_user_rates ADD COLUMN budget_hours NUMERIC(10,2);
ALTER TABLE project_user_rates ADD COLUMN budget_cents BIGINT;

-- 5. Drop old global time-category tables (project-specific tasks replace them)
DROP TABLE IF EXISTS project_time_categories;
DROP TABLE IF EXISTS time_categories;

-- 6. Tasks: project-specific, each with an optional overall hours budget
CREATE TABLE tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  budget_hours NUMERIC(10,2),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);

-- 7. Task user budgets: per-employee hour budget for a task
CREATE TABLE task_user_budgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  budget_hours NUMERIC(10,2),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX idx_task_user_budgets_task_id ON task_user_budgets(task_id);

-- 8. Link time entries to a task (replaces project_time_category_id)
ALTER TABLE time_entries ADD COLUMN task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
CREATE INDEX idx_time_entries_task_id ON time_entries(task_id);
