-- ============================================================================
-- Migration: Phase 1 — Workspace Discipline
-- Phase: 1
-- Purpose: Reconcile tickets.workspace to canonical service_workspaces.code,
--          add NOT NULL + FK constraint, add normalisation trigger, denormalise
--          workspace onto ticket_history and ticket_comments for RLS.
-- Spec ref: spec §5.1; design §2.4.1
-- Idempotency: CREATE TABLE IF NOT EXISTS, ON CONFLICT DO NOTHING,
--              DROP TRIGGER IF EXISTS before CREATE TRIGGER,
--              DO $$ IF NOT EXISTS $$ guards for constraints
-- Rollback: 2026-11-20-phase1-workspace-discipline-rollback.sql
-- Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction; using
--       regular CREATE INDEX IF NOT EXISTS instead. For production, DBA may
--       create indexes concurrently before running this migration.
-- Note: PostgreSQL does not support subqueries in CHECK constraints; using
--       FK to service_workspaces(code) instead (code is UNIQUE).
-- ============================================================================

BEGIN;

-- Step 1: Create backup of original workspace values for rollback
CREATE TABLE IF NOT EXISTS tickets_workspace_backup (
  id BIGINT PRIMARY KEY,
  original_workspace VARCHAR,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tickets_workspace_backup (id, original_workspace)
  SELECT id, workspace FROM tickets
  ON CONFLICT (id) DO NOTHING;

-- Step 2: Reconcile legacy workspace values to canonical codes
-- 2a: Finance variants -> FIN
UPDATE tickets SET workspace = 'FIN'
  WHERE LOWER(COALESCE(workspace, '')) IN ('finance', 'finance department')
    AND workspace <> 'FIN';

-- 2b: IT variants -> IT (including IT Service Request, ERP/Syspro, Change Mgmt, Project Mgmt)
UPDATE tickets SET workspace = 'IT'
  WHERE LOWER(COALESCE(workspace, '')) IN (
    'it', 'information technology',
    'it service request', 'erp / syspro', 'change management', 'project management'
  ) AND workspace <> 'IT';

-- 2c: HR variants -> HR
UPDATE tickets SET workspace = 'HR'
  WHERE LOWER(COALESCE(workspace, '')) IN ('hr', 'human resources')
    AND workspace <> 'HR';

-- 2d: Facilities variants -> FAC
UPDATE tickets SET workspace = 'FAC'
  WHERE LOWER(COALESCE(workspace, '')) IN ('fac', 'facilities')
    AND workspace <> 'FAC';

-- 2e: PDM variants -> PDM
UPDATE tickets SET workspace = 'PDM'
  WHERE LOWER(COALESCE(workspace, '')) IN (
    'process engineering (pdm)', 'pdm', 'process engineering'
  ) AND workspace <> 'PDM';

-- Step 3: Set workspace to 'IT' for any remaining null/empty/unmapped values (safe default)
UPDATE tickets SET workspace = 'IT'
  WHERE workspace IS NULL OR workspace = ''
     OR workspace NOT IN ('IT', 'HR', 'FIN', 'FAC', 'PDM');

-- Step 4: Activate all workspace codes in service_workspaces
UPDATE service_workspaces SET status = 'active'
  WHERE code IN ('IT', 'HR', 'FIN', 'FAC', 'PDM') AND status <> 'active';

-- Step 5: Add NOT NULL constraint
ALTER TABLE tickets ALTER COLUMN workspace SET NOT NULL;

-- Step 6: Add FK constraint to service_workspaces(code) (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tickets_workspace_valid_code'
  ) THEN
    ALTER TABLE tickets ADD CONSTRAINT tickets_workspace_valid_code
      FOREIGN KEY (workspace) REFERENCES service_workspaces(code);
  END IF;
END $$;

-- Step 7: Create normalisation trigger function
CREATE OR REPLACE FUNCTION normalise_ticket_workspace()
RETURNS TRIGGER AS $$
BEGIN
  NEW.workspace := CASE
    WHEN LOWER(NEW.workspace) IN ('finance', 'finance department') THEN 'FIN'
    WHEN LOWER(NEW.workspace) IN (
      'it', 'information technology',
      'it service request', 'erp / syspro', 'change management', 'project management'
    ) THEN 'IT'
    WHEN LOWER(NEW.workspace) IN ('hr', 'human resources') THEN 'HR'
    WHEN LOWER(NEW.workspace) IN ('fac', 'facilities') THEN 'FAC'
    WHEN LOWER(NEW.workspace) IN (
      'process engineering (pdm)', 'pdm', 'process engineering'
    ) THEN 'PDM'
    WHEN NEW.workspace IS NULL OR NEW.workspace = '' THEN 'IT'
    ELSE NEW.workspace
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger (idempotent — drop then create)
DROP TRIGGER IF EXISTS trg_normalise_ticket_workspace ON tickets;
CREATE TRIGGER trg_normalise_ticket_workspace
  BEFORE INSERT OR UPDATE OF workspace ON tickets
  FOR EACH ROW EXECUTE FUNCTION normalise_ticket_workspace();

-- Step 9: Create B-tree index for RLS policy predicates
CREATE INDEX IF NOT EXISTS ix_tickets_workspace ON tickets(workspace);

-- Step 10: Denormalise workspace onto ticket_history for RLS
ALTER TABLE ticket_history ADD COLUMN IF NOT EXISTS workspace VARCHAR(50);

UPDATE ticket_history h SET workspace = t.workspace
  FROM tickets t WHERE t.id = h.ticket_id AND h.workspace IS NULL;

UPDATE ticket_history SET workspace = 'IT'
  WHERE workspace IS NULL;

ALTER TABLE ticket_history ALTER COLUMN workspace SET NOT NULL;

CREATE INDEX IF NOT EXISTS ix_ticket_history_workspace ON ticket_history(workspace);

-- Step 11: Denormalise workspace onto ticket_comments for RLS
ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS workspace VARCHAR(50);

UPDATE ticket_comments c SET workspace = t.workspace
  FROM tickets t WHERE t.id = c.ticket_id AND c.workspace IS NULL;

UPDATE ticket_comments SET workspace = 'IT'
  WHERE workspace IS NULL;

ALTER TABLE ticket_comments ALTER COLUMN workspace SET NOT NULL;

CREATE INDEX IF NOT EXISTS ix_ticket_comments_workspace ON ticket_comments(workspace);

COMMIT;