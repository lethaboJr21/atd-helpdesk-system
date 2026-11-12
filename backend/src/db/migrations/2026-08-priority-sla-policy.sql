BEGIN;
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_policy_key varchar(120),
  ADD COLUMN IF NOT EXISTS sla_policy_version integer,
  ADD COLUMN IF NOT EXISTS sla_calculated_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_response_minutes integer,
  ADD COLUMN IF NOT EXISTS sla_resolution_minutes integer;
CREATE INDEX IF NOT EXISTS idx_tickets_response_due_active ON tickets(response_due_at) WHERE status NOT IN ('Resolved','Closed');
CREATE INDEX IF NOT EXISTS idx_tickets_resolution_due_active ON tickets(due_at) WHERE status NOT IN ('Resolved','Closed');
INSERT INTO system_settings(setting_key,setting_value,description)
VALUES('sla.priority_policy','{"version":1,"timezone":"Africa/Johannesburg","clock":"elapsed","priorities":{"Critical":{"responseMinutes":15,"resolutionMinutes":240},"High":{"responseMinutes":30,"resolutionMinutes":480},"Medium":{"responseMinutes":240,"resolutionMinutes":2880},"Low":{"responseMinutes":480,"resolutionMinutes":7200}}}'::jsonb,'Priority SLA policy. Targets are minutes and may be governed through system settings.')
ON CONFLICT(setting_key) DO NOTHING;
COMMIT;
