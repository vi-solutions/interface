-- 004_role_to_is_admin.sql
-- Replace role text column with is_admin boolean

ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users SET is_admin = TRUE WHERE role = 'admin';

ALTER TABLE users DROP COLUMN role;
