-- ============================================================================
-- Migration: Phase 2 — Finance Column Migration
-- Phase: 2
-- Purpose: Migrate 9 Finance-specific columns from tickets to
--          finance_ticket_operations, backfill data, create anomaly detection
--          table, add deprecation comments, create indexes.
-- Spec ref: spec §5.2; design §2.4.2
-- Idempotency: ADD COLUMN IF NOT EXISTS, ON CONFLICT DO NOTHING,
--              CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS
-- Rollback: 2026-11-21-phase2-finance-column-migration-rollback.sql
-- Prerequisite: Phase 1 complete (canonical workspace='FIN' required)
-- ============================================================================

BEGIN;

-- Step 1: Add migrated columns to finance_ticket_operations (idempotent)
ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS evidence_state VARCHAR(20) NOT NULL DEFAULT 'not_required';
ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS review_state VARCHAR(30);
ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS kpi_objective VARCHAR(60);
ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS kpi_period VARCHAR(20);
ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS baseline_assigned_at TIMESTAMPTZ;
ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS original_due_at TIMESTAMPTZ;
ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS effective_due_at TIMESTAMPTZ;
ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS closed_by BIGINT;
-- confidentiality_level already exists on fto

-- Step 2: Create finance_ticket_operations rows for Finance tickets that lack one
INSERT INTO finance_ticket_operations (ticket_id, triage_state)
  SELECT t.id, 'triage_required'
  FROM tickets t
  WHERE t.workspace = 'FIN'
    AND NOT EXISTS (SELECT 1 FROM finance_ticket_operations fto WHERE fto.ticket_id = t.id)
  ON CONFLICT (ticket_id) DO NOTHING;

-- Step 3: Backfill migrated columns from tickets for Finance tickets
UPDATE finance_ticket_operations fto SET
  evidence_state = COALESCE(t.evidence_state, 'not_required'),
  review_state = t.review_state,
  kpi_objective = t.kpi_objective,
  kpi_period = t.kpi_period,
  baseline_assigned_at = t.baseline_assigned_at,
  original_due_at = t.original_due_at,
  effective_due_at = t.effective_due_at,
  closed_at = t.closed_at,
  closed_by = t.closed_by
  FROM tickets t
  WHERE t.id = fto.ticket_id
    AND t.workspace = 'FIN';

-- Step 4: Create anomaly detection table
CREATE TABLE IF NOT EXISTS finance_migration_anomalies (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  column_name VARCHAR(60) NOT NULL,
  value TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticket_id, column_name)
);

-- Step 4a: Detect non-Finance tickets with Finance column values (anomalies)
INSERT INTO finance_migration_anomalies (ticket_id, column_name, value)
  SELECT t.id, 'evidence_state', t.evidence_state::text
  FROM tickets t
  WHERE t.workspace <> 'FIN' AND t.evidence_state IS NOT NULL AND t.evidence_state <> 'not_required'
  ON CONFLICT (ticket_id, column_name) DO NOTHING;

INSERT INTO finance_migration_anomalies (ticket_id, column_name, value)
  SELECT t.id, 'review_state', t.review_state::text
  FROM tickets t
  WHERE t.workspace <> 'FIN' AND t.review_state IS NOT NULL
  ON CONFLICT (ticket_id, column_name) DO NOTHING;

INSERT INTO finance_migration_anomalies (ticket_id, column_name, value)
  SELECT t.id, 'kpi_objective', t.kpi_objective::text
  FROM tickets t
  WHERE t.workspace <> 'FIN' AND t.kpi_objective IS NOT NULL
  ON CONFLICT (ticket_id, column_name) DO NOTHING;

INSERT INTO finance_migration_anomalies (ticket_id, column_name, value)
  SELECT t.id, 'kpi_period', t.kpi_period::text
  FROM tickets t
  WHERE t.workspace <> 'FIN' AND t.kpi_period IS NOT NULL
  ON CONFLICT (ticket_id, column_name) DO NOTHING;

INSERT INTO finance_migration_anomalies (ticket_id, column_name, value)
  SELECT t.id, 'baseline_assigned_at', t.baseline_assigned_at::text
  FROM tickets t
  WHERE t.workspace <> 'FIN' AND t.baseline_assigned_at IS NOT NULL
  ON CONFLICT (ticket_id, column_name) DO NOTHING;

INSERT INTO finance_migration_anomalies (ticket_id, column_name, value)
  SELECT t.id, 'original_due_at', t.original_due_at::text
  FROM tickets t
  WHERE t.workspace <> 'FIN' AND t.original_due_at IS NOT NULL
  ON CONFLICT (ticket_id, column_name) DO NOTHING;

INSERT INTO finance_migration_anomalies (ticket_id, column_name, value)
  SELECT t.id, 'effective_due_at', t.effective_due_at::text
  FROM tickets t
  WHERE t.workspace <> 'FIN' AND t.effective_due_at IS NOT NULL
  ON CONFLICT (ticket_id, column_name) DO NOTHING;

INSERT INTO finance_migration_anomalies (ticket_id, column_name, value)
  SELECT t.id, 'closed_at', t.closed_at::text
  FROM tickets t
  WHERE t.workspace <> 'FIN' AND t.closed_at IS NOT NULL
  ON CONFLICT (ticket_id, column_name) DO NOTHING;

INSERT INTO finance_migration_anomalies (ticket_id, column_name, value)
  SELECT t.id, 'closed_by', t.closed_by::text
  FROM tickets t
  WHERE t.workspace <> 'FIN' AND t.closed_by IS NOT NULL
  ON CONFLICT (ticket_id, column_name) DO NOTHING;

-- Step 5: Add deprecation comments to tickets columns
COMMENT ON COLUMN tickets.evidence_state IS 'DEPRECATED (Phase 2): migrated to finance_ticket_operations.evidence_state. Retained for rollback.';
COMMENT ON COLUMN tickets.review_state IS 'DEPRECATED (Phase 2): migrated to finance_ticket_operations.review_state. Retained for rollback.';
COMMENT ON COLUMN tickets.kpi_objective IS 'DEPRECATED (Phase 2): migrated to finance_ticket_operations.kpi_objective. Retained for rollback.';
COMMENT ON COLUMN tickets.kpi_period IS 'DEPRECATED (Phase 2): migrated to finance_ticket_operations.kpi_period. Retained for rollback.';
COMMENT ON COLUMN tickets.baseline_assigned_at IS 'DEPRECATED (Phase 2): migrated to finance_ticket_operations.baseline_assigned_at. Retained for rollback.';
COMMENT ON COLUMN tickets.original_due_at IS 'DEPRECATED (Phase 2): migrated to finance_ticket_operations.original_due_at. Retained for rollback.';
COMMENT ON COLUMN tickets.effective_due_at IS 'DEPRECATED (Phase 2): migrated to finance_ticket_operations.effective_due_at. Retained for rollback.';
COMMENT ON COLUMN tickets.closed_at IS 'DEPRECATED (Phase 2): migrated to finance_ticket_operations.closed_at. Retained for rollback.';
COMMENT ON COLUMN tickets.closed_by IS 'DEPRECATED (Phase 2): migrated to finance_ticket_operations.closed_by. Retained for rollback.';

-- Step 6: Create indexes on migrated fto columns
CREATE INDEX IF NOT EXISTS ix_fto_kpi_objective_period
  ON finance_ticket_operations (kpi_objective, kpi_period)
  WHERE kpi_objective IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_fto_effective_due
  ON finance_ticket_operations (effective_due_at)
  WHERE effective_due_at IS NOT NULL;

COMMIT;