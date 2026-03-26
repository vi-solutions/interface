-- 007_expenses.sql
-- Global expense definitions and per-project overrides

CREATE TABLE expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL CHECK (type IN ('absolute', 'per_km', 'per_day')),
  default_rate_cents BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE project_expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  expense_id      UUID REFERENCES expenses(id) ON DELETE CASCADE,
  name            TEXT,
  description     TEXT,
  type            TEXT CHECK (type IN ('absolute', 'per_km', 'per_day')),
  rate_cents      BIGINT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, expense_id)
);

-- When expense_id is set: inherited expense with rate override (name/type from parent)
-- When expense_id is null: project-specific expense (name and type required)
ALTER TABLE project_expenses ADD CONSTRAINT project_expenses_custom_check
  CHECK (
    (expense_id IS NOT NULL) OR
    (name IS NOT NULL AND type IS NOT NULL)
  );

CREATE INDEX idx_project_expenses_project_id ON project_expenses(project_id);
CREATE INDEX idx_project_expenses_expense_id ON project_expenses(expense_id);
