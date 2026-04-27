-- 022_contacts_agency_nullable_client.sql
-- 1. Add agency field to contacts
ALTER TABLE contacts ADD COLUMN agency TEXT;

-- 2. Make client_id nullable so contacts can exist without a client
ALTER TABLE contacts ALTER COLUMN client_id DROP NOT NULL;
