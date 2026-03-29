-- QuickBooks Online integration

-- Single-row table storing OAuth tokens + realm for the connected QBO company
CREATE TABLE IF NOT EXISTS qbo_connection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link our clients to QBO Customers
ALTER TABLE clients ADD COLUMN qbo_customer_id TEXT;

-- Track synced time entries as QBO TimeActivities
ALTER TABLE time_entries ADD COLUMN qbo_time_activity_id TEXT;

-- Track synced user expenses as QBO Purchases
ALTER TABLE user_expenses ADD COLUMN qbo_expense_id TEXT;
