-- 008_rename_expense_fields.sql
-- Rename absolute -> dollar, default_rate_cents -> rate_cents

ALTER TABLE expenses RENAME COLUMN default_rate_cents TO rate_cents;
ALTER TABLE expenses ALTER COLUMN rate_cents DROP NOT NULL;
ALTER TABLE expenses ALTER COLUMN rate_cents SET DEFAULT NULL;

-- Update type values before re-adding constraints
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_type_check;
UPDATE expenses SET type = 'dollar' WHERE type = 'absolute';
ALTER TABLE expenses ADD CONSTRAINT expenses_type_check
  CHECK (type IN ('dollar', 'per_km', 'per_day'));

ALTER TABLE project_expenses DROP CONSTRAINT IF EXISTS project_expenses_type_check;
UPDATE project_expenses SET type = 'dollar' WHERE type = 'absolute';
ALTER TABLE project_expenses ADD CONSTRAINT project_expenses_type_check
  CHECK (type IS NULL OR type IN ('dollar', 'per_km', 'per_day'));
