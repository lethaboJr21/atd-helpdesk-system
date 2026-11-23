-- ============================================================================
-- Migration: Phase 2 — Finance Column Migration (ROLLBACK)
-- Phase: 2
-- Purpose: Reverse Phase 2 migration — drop migrated columns from fto,
--          drop anomaly table, remove deprecation comments from tickets.
--          tickets columns remain as authoritative source.
-- Spec ref: spec §5.2; design §2.4.2
-- Idempotency: DROP COLUMN IF EXISTS, DROP TABLE IF EXISTS
-- ============================================================================

BEGIN;

-- Step 1: Drop indexes on migrated fto columns
DROP INDEX IF EXISTS ix_fto_kpi_objective_period;
DROP INDEX IF EXISTS ix_fto_effective_due;

-- Step 2: Remove deprecation comments from tickets columns
COMMENT ON COLUMN tickets.evidence_state IS NULL;
COMMENT ON COLUMN tickets.review_state IS NULL;
COMMENT ON COLUMN tickets.kpi_objective IS NULL;
COMMENT ON COLUMN tickets.kpi_period IS NULL;
COMMENT ON COLUMN tickets.baseline_assigned_at IS NULL;
COMMENT ON COLUMN tickets.original_due_at IS NULL;
COMMENT ON COLUMN tickets.effective_due_at IS NULL;
COMMENT ON COLUMN tickets.closed_at IS NULL;
COMMENT ON COLUMN tickets.closed_by IS NULL;

-- Step 3: Drop anomaly detection table
DROP TABLE IF EXISTS finance_migration_anomalies;

-- Step 4: Drop migrated columns from finance_ticket_operations
ALTER TABLE finance_ticket_operations DROP COLUMN IF EXISTS evidence_state;
ALTER TABLE finance_ticket_operations DROP COLUMN IF EXISTS review_state;
ALTER TABLE finance_ticket_operations DROP COLUMN IF EXISTS kpi_objective;
ALTER TABLE finance_ticket_operations DROP COLUMN IF EXISTS kpi_period;
ALTER TABLE finance_ticket_operations DROP COLUMN IF EXISTS baseline_assigned_at;
ALTER TABLE finance_ticket_operations DROP COLUMN IF EXISTS original_due_at;
ALTER TABLE finance_ticket_operations DROP COLUMN IF EXISTS effective_due_at;
ALTER TABLE finance_ticket_operations DROP COLUMN IF EXISTS closed_at;
ALTER TABLE finance_ticket_operations DROP COLUMN IF EXISTS closed_by;

COMMIT;