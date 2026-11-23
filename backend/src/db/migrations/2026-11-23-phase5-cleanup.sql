-- ============================================================================
-- Migration: Phase 5 — Verification + Cleanup
-- Phase: 5
-- Purpose: Verify 100% data parity between tickets and finance_ticket_operations
--          for the migrated Finance columns, then drop the deprecated Finance-only
--          columns from tickets, remove backup/anomaly tables, and finalise.
--
--          DESIGN ADJUSTMENT: 3 columns (original_due_at, effective_due_at,
--          closed_at) have meaningful non-Finance (IT) data and are retained
--          as shared columns on tickets. Only 6 Finance-only columns are dropped:
--          evidence_state, review_state, kpi_objective, kpi_period,
--          baseline_assigned_at, closed_by.
--
-- Spec ref: spec §5.8; design §2.4.5
-- Idempotency: ALTER TABLE DROP COLUMN IF EXISTS, DROP TABLE IF EXISTS
-- Rollback: 2026-11-23-phase5-cleanup-rollback.sql
-- Prerequisite: Phases 1-4 complete and validated
-- ============================================================================

BEGIN;

-- Step 1: Verify 100% data parity between tickets and finance_ticket_operations
--         for all 9 migrated columns over Finance tickets.
--         If any mismatch is found, abort the migration to prevent data loss.
DO $$
DECLARE
  mismatch_count INTEGER;
  missing_fto_count INTEGER;
BEGIN
  -- Check that every Finance ticket has an fto row
  SELECT COUNT(*) INTO missing_fto_count
  FROM tickets t
  WHERE t.workspace = 'FIN'
    AND NOT EXISTS (SELECT 1 FROM finance_ticket_operations fto WHERE fto.ticket_id = t.id);

  IF missing_fto_count > 0 THEN
    RAISE EXCEPTION 'DATA_PARITY_MISMATCH: % Finance tickets are missing a finance_ticket_operations row', missing_fto_count;
  END IF;

  -- Check column-level parity for all 9 migrated columns
  SELECT COUNT(*) INTO mismatch_count
  FROM tickets t
  JOIN finance_ticket_operations fto ON fto.ticket_id = t.id
  WHERE t.workspace = 'FIN'
    AND (
      COALESCE(t.evidence_state, 'not_required') IS DISTINCT FROM COALESCE(fto.evidence_state, 'not_required')
      OR t.review_state IS DISTINCT FROM fto.review_state
      OR t.kpi_objective IS DISTINCT FROM fto.kpi_objective
      OR t.kpi_period IS DISTINCT FROM fto.kpi_period
      OR t.baseline_assigned_at IS DISTINCT FROM fto.baseline_assigned_at
      OR t.original_due_at IS DISTINCT FROM fto.original_due_at
      OR t.effective_due_at IS DISTINCT FROM fto.effective_due_at
      OR t.closed_at IS DISTINCT FROM fto.closed_at
      OR t.closed_by IS DISTINCT FROM fto.closed_by
    );

  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'DATA_PARITY_MISMATCH: % Finance tickets have column values that differ between tickets and finance_ticket_operations', mismatch_count;
  END IF;
END $$;

-- Step 2: Drop the 6 Finance-only columns from tickets
--         (evidence_state: all non-Finance values are default 'not_required')
--         (review_state, kpi_objective, kpi_period, baseline_assigned_at, closed_by: no non-Finance values)
--         RETAINED as shared columns: original_due_at, effective_due_at, closed_at
--         (these have meaningful IT ticket data — 19 IT tickets with due dates, 6 IT tickets with closed_at)
ALTER TABLE tickets DROP COLUMN IF EXISTS evidence_state;
ALTER TABLE tickets DROP COLUMN IF EXISTS review_state;
ALTER TABLE tickets DROP COLUMN IF EXISTS kpi_objective;
ALTER TABLE tickets DROP COLUMN IF EXISTS kpi_period;
ALTER TABLE tickets DROP COLUMN IF EXISTS baseline_assigned_at;
ALTER TABLE tickets DROP COLUMN IF EXISTS closed_by;

-- Step 3: Drop migration temporary tables
DROP TABLE IF EXISTS tickets_workspace_backup;
DROP TABLE IF EXISTS finance_migration_anomalies;

-- Step 4: Update comments
COMMENT ON TABLE finance_ticket_operations IS 'Finance ticket operations extension table. Authoritative source for evidence_state, review_state, kpi_objective, kpi_period, baseline_assigned_at, closed_by (dropped from tickets in Phase 5). Columns original_due_at, effective_due_at, closed_at remain as shared columns on tickets due to non-Finance usage.';
COMMENT ON COLUMN tickets.original_due_at IS 'Shared column: original due date (used by both Finance and IT tickets). Finance values also copied to finance_ticket_operations.';
COMMENT ON COLUMN tickets.effective_due_at IS 'Shared column: effective due date after extensions (used by both Finance and IT tickets). Finance values also copied to finance_ticket_operations.';
COMMENT ON COLUMN tickets.closed_at IS 'Shared column: closure timestamp (used by both Finance and IT tickets). Finance values also copied to finance_ticket_operations.';

COMMIT;