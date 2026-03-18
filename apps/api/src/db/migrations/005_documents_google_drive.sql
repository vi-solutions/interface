-- 005_documents_google_drive.sql
-- Adapt documents table for Google Drive integration

ALTER TABLE documents
  ADD COLUMN google_drive_url TEXT,
  ADD COLUMN google_drive_file_id TEXT;

-- Migrate existing file_key data (if any) to google_drive_file_id
UPDATE documents SET google_drive_file_id = file_key WHERE file_key IS NOT NULL;

-- Make size_bytes and mime_type nullable
ALTER TABLE documents
  ALTER COLUMN size_bytes DROP NOT NULL,
  ALTER COLUMN mime_type DROP NOT NULL;

-- Drop old file_key column
ALTER TABLE documents DROP COLUMN file_key;
