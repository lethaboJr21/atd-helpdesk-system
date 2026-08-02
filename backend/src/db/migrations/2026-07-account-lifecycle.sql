BEGIN;

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(30) NOT NULL DEFAULT 'person';
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_by INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_deactivated_by_fkey') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_deactivated_by_fkey
      FOREIGN KEY (deactivated_by)
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_account_type_check') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_account_type_check
      CHECK (account_type IN ('person','shared','service','department','automation','generic','external'));
  END IF;
END $$;

UPDATE users
SET account_type = 'person'
WHERE account_type IS NULL OR TRIM(account_type) = '';

CREATE INDEX IF NOT EXISTS idx_users_account_state
  ON users (archived_at, approved, status, last_login_at);
CREATE INDEX IF NOT EXISTS idx_users_account_type
  ON users (account_type);
CREATE INDEX IF NOT EXISTS idx_users_deactivated_at
  ON users (deactivated_at);

COMMIT;
