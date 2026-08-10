ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE time_entry_reminders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_date  DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed', 'sent', 'failed')),
  claimed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at        TIMESTAMPTZ,
  last_error     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, reminder_date)
);

CREATE INDEX idx_time_entry_reminders_date
  ON time_entry_reminders (reminder_date);
