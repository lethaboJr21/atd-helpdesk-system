BEGIN;
CREATE TABLE IF NOT EXISTS production_operator_team_assignments(
 id BIGSERIAL PRIMARY KEY,
 operator_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 team_leader_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 plant_code VARCHAR(80), line_code VARCHAR(120), station_code VARCHAR(160), shift_code VARCHAR(80),
 effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(), effective_to TIMESTAMPTZ,
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 assigned_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(operator_user_id<>team_leader_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_production_operator_primary_team_leader ON production_operator_team_assignments(operator_user_id) WHERE is_active=TRUE AND effective_to IS NULL;
CREATE INDEX IF NOT EXISTS ix_production_team_leader_active ON production_operator_team_assignments(team_leader_user_id,is_active);
DO $$ BEGIN
 IF to_regclass('public.line_ticket_staging') IS NOT NULL THEN
  ALTER TABLE line_ticket_staging ADD COLUMN IF NOT EXISTS team_leader_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE line_ticket_staging ADD COLUMN IF NOT EXISTS team_leader_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
 END IF;
END $$;
COMMIT;