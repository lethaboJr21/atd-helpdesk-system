-- User profile and Microsoft 365 synchronization fields
-- Safe, additive migration for the existing ATD Helpdesk users table.

BEGIN;

-- New portal users must never default to administrator access.
ALTER TABLE users
  ALTER COLUMN role SET DEFAULT 'user';

-- Make approval behaviour predictable for future inserts.
UPDATE users
SET approved = FALSE
WHERE approved IS NULL;

ALTER TABLE users
  ALTER COLUMN approved SET DEFAULT FALSE;

ALTER TABLE users
  ALTER COLUMN approved SET NOT NULL;

-- Microsoft / employee profile fields.
ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS office_location VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_account_enabled BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_user_type VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_created_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_microsoft_sync_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_sync_status VARCHAR(30);

-- Employee fields that can be managed locally.
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_number VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_name VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS site VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_status VARCHAR(30) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS termination_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alternative_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Archiving preserves tickets, history, assignments, and audit relationships.
ALTER TABLE users ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS archived_by INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS archive_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_archived_by_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_archived_by_fkey
      FOREIGN KEY (archived_by)
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_microsoft_id_unique
  ON users (microsoft_id)
  WHERE microsoft_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_department
  ON users (department);

CREATE INDEX IF NOT EXISTS idx_users_status
  ON users (status);

CREATE INDEX IF NOT EXISTS idx_users_employment_status
  ON users (employment_status);

CREATE INDEX IF NOT EXISTS idx_users_archived_at
  ON users (archived_at);

COMMIT;
