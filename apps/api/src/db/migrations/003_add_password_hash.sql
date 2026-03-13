-- 003_add_password_hash.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
