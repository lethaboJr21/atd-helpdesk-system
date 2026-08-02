BEGIN;

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key varchar(120) PRIMARY KEY,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_feature_entitlements (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key varchar(120) NOT NULL,
  enabled boolean NOT NULL DEFAULT TRUE,
  updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, feature_key)
);

CREATE TABLE IF NOT EXISTS user_email_preferences (
  user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT TRUE,
  assignment_emails boolean NOT NULL DEFAULT TRUE,
  ticket_update_emails boolean NOT NULL DEFAULT TRUE,
  reminder_emails boolean NOT NULL DEFAULT TRUE,
  escalation_emails boolean NOT NULL DEFAULT TRUE,
  administrative_emails boolean NOT NULL DEFAULT TRUE,
  updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS administration_audit_log (
  id bigserial PRIMARY KEY,
  actor_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  target_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  action varchar(120) NOT NULL,
  old_value jsonb,
  new_value jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_target_created
  ON administration_audit_log(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor_created
  ON administration_audit_log(actor_user_id, created_at DESC);

INSERT INTO system_settings (setting_key, setting_value, description)
VALUES
  ('email.mode', '"live"'::jsonb, 'Email delivery mode: live, testing or disabled.'),
  ('email.test_recipients', '[]'::jsonb, 'Recipients used when email mode is testing.'),
  ('email.categories', '{"account_request":true,"account_approval":true,"welcome":true,"ticket_assignment":true,"ticket_update":true,"reminder":true,"escalation":true,"requester_update":true}'::jsonb, 'System email category switches.')
ON CONFLICT (setting_key) DO NOTHING;

COMMIT;
