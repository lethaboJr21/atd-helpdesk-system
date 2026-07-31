BEGIN;

ALTER TABLE support_groups
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_default_triage BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notification_email TEXT,
  ADD COLUMN IF NOT EXISTS manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escalation_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS support_groups_one_default_triage_idx
  ON support_groups (is_default_triage)
  WHERE is_default_triage = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS support_group_members_unique_idx
  ON support_group_members (group_id, user_id);

CREATE INDEX IF NOT EXISTS support_group_members_user_idx
  ON support_group_members (user_id);

COMMIT;
