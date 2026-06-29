-- Ensure existing pay_period_locks tables have the uniqueness expected by the API.

DELETE FROM pay_period_locks older
USING pay_period_locks newer
WHERE older.period_start = newer.period_start
  AND older.period_end = newer.period_end
  AND (
    older.locked_at < newer.locked_at
    OR (
      older.locked_at = newer.locked_at
      AND older.id::text < newer.id::text
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pay_period_locks_unique_period'
      AND conrelid = 'pay_period_locks'::regclass
  ) THEN
    ALTER TABLE pay_period_locks
      ADD CONSTRAINT pay_period_locks_unique_period
      UNIQUE (period_start, period_end);
  END IF;
END $$;
