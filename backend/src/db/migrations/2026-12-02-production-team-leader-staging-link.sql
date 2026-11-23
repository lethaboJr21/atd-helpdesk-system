BEGIN;
ALTER TABLE line_ticket_staging ADD COLUMN IF NOT EXISTS team_leader_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE line_ticket_staging ADD COLUMN IF NOT EXISTS team_leader_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS ix_line_ticket_staging_team_leader ON line_ticket_staging(team_leader_user_id,status,created_at DESC);
COMMIT;