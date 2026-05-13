-- Add role column to users: employee | contractor | admin
-- Existing admins get 'admin', everyone else gets 'contractor'
-- (matches the old 'employee' concept which is now renamed to contractor)

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'contractor';
UPDATE users SET role = 'admin' WHERE is_admin = TRUE;
