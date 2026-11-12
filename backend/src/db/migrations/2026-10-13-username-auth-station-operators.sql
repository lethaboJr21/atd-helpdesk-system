BEGIN;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS authentication_mode VARCHAR(30) NOT NULL DEFAULT 'auto';
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_purpose VARCHAR(40) NOT NULL DEFAULT 'employee';
ALTER TABLE users ADD COLUMN IF NOT EXISTS plant_code VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS station_code VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS shift_code VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS station_signup_requested_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(LOWER(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_authentication_route_idx ON users(authentication_mode,account_purpose,status,approved);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='users_authentication_mode_check') THEN
  ALTER TABLE users ADD CONSTRAINT users_authentication_mode_check CHECK(authentication_mode IN('auto','microsoft','local_password'));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='users_account_purpose_check') THEN
  ALTER TABLE users ADD CONSTRAINT users_account_purpose_check CHECK(account_purpose IN('employee','external_local','superadmin','station_operator'));
 END IF;
END $$;
UPDATE users SET authentication_mode='local_password',account_purpose='superadmin' WHERE role='superadmin';
UPDATE users SET authentication_mode='microsoft' WHERE role<>'superadmin' AND LOWER(COALESCE(email,'')) LIKE '%@atdalliance.co.za';
COMMIT;
