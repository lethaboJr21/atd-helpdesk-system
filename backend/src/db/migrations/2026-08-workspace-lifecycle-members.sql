BEGIN;

CREATE TABLE IF NOT EXISTS workspace_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES service_workspaces(id) ON DELETE CASCADE,
  from_status varchar(20),
  to_status varchar(20) NOT NULL,
  reason text,
  readiness_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_lifecycle_workspace_date
  ON workspace_lifecycle_events(workspace_id, created_at DESC);

ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_by integer REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deactivation_reason text;

CREATE INDEX IF NOT EXISTS idx_workspace_members_role_active
  ON workspace_members(workspace_id, member_role, is_active);

COMMIT;