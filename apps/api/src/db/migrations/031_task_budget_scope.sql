-- 031_task_budget_scope.sql
-- Allow billable added-scope tasks to stay outside project budget burn.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS counts_toward_budget BOOLEAN NOT NULL DEFAULT true;
