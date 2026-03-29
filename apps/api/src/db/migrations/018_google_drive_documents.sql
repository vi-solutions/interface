-- 018_google_drive_documents.sql
-- Google Drive integration: OAuth connection, project codes, document categories, folder tracking

-- Google Drive OAuth connection (single-tenant, like QBO)
CREATE TABLE IF NOT EXISTS google_drive_connection (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  access_token_expires_at  TIMESTAMPTZ NOT NULL,
  root_folder_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project code for Drive folder naming: [YEAR-XX-XXX]
ALTER TABLE projects ADD COLUMN IF NOT EXISTS code TEXT;

-- Google Drive folder ID for the project's root folder
ALTER TABLE projects ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT;

-- Document category matching drive subfolders
ALTER TABLE documents ADD COLUMN IF NOT EXISTS category TEXT;

-- Track size_bytes from actual upload
ALTER TABLE documents ALTER COLUMN size_bytes TYPE BIGINT;
