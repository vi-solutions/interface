-- Pay period locks

CREATE TABLE IF NOT EXISTS pay_period_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  locked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pay_period_locks_period_valid CHECK (period_start <= period_end),
  CONSTRAINT pay_period_locks_unique_period UNIQUE (period_start, period_end)
);

CREATE INDEX IF NOT EXISTS pay_period_locks_date_idx
  ON pay_period_locks(period_start, period_end);
