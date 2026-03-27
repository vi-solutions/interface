-- Add default hourly rate to users
ALTER TABLE users ADD COLUMN rate_cents BIGINT NOT NULL DEFAULT 0;

-- Per-project user rates (charge-out rates per team member per project)
CREATE TABLE project_user_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rate_type   TEXT NOT NULL DEFAULT 'hourly' CHECK (rate_type IN ('hourly', 'daily')),
  rate_cents  BIGINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);
