-- 009_user_expenses.sql
-- Actual expense entries submitted by users on a project

CREATE TABLE user_expenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_expense_id UUID NOT NULL REFERENCES project_expenses(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  quantity          NUMERIC(12, 4),
  total_cents       BIGINT NOT NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- quantity is required for per_km / per_day types but not for dollar
-- total_cents is always stored (for dollar it's the amount, for others it's quantity * rate)

CREATE INDEX idx_user_expenses_project_id ON user_expenses(project_id);
CREATE INDEX idx_user_expenses_user_id ON user_expenses(user_id);
CREATE INDEX idx_user_expenses_date ON user_expenses(date);
