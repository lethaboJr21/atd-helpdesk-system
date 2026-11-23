-- ============================================================================
-- Rollback: Phase 5 — Verification + Cleanup
-- Phase: 5
-- Purpose: Re-add the 6 dropped Finance-only columns to tickets and backfill
--          from finance_ticket_operations. Recreate anomaly table.
--          (original_due_at, effective_due_at, closed_at were NOT dropped —
--          they remain as shared columns.)
-- Spec ref: spec §5.8; design §2.4.5
-- Prerequisite: Phase 5 migration was applied
-- ============================================================================

BEGIN;

-- Step 1: Re-add the 6 dropped columns to tickets (nullable, same types as original)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS evidence_state VARCHAR(20) DEFAULT 'not_required';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS review_state VARCHAR(30);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS kpi_objective VARCHAR(60);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS kpi_period VARCHAR(20);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS baseline_assigned_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_by BIGINT;

-- Step 2: Backfill from finance_ticket_operations for Finance tickets
UPDATE tickets t SET
  evidence_state = fto.evidence_state,
  review_state = fto.review_state,
  kpi_objective = fto.kpi_objective,
  kpi_period = fto.kpi_period,
  baseline_assigned_at = fto.baseline_assigned_at,
  closed_by = fto.closed_by
  FROM finance_ticket_operations fto
  WHERE fto.ticket_id = t.id
    AND t.workspace = 'FIN';

-- Step 3: Set default evidence_state for non-Finance tickets
UPDATE tickets t SET evidence_state = 'not_required'
  WHERE t.evidence_state IS NULL AND t.workspace <> 'FIN';

-- Step 4: Recreate anomaly detection table (empty)
CREATE TABLE IF NOT EXISTS finance_migration_anomalies (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  column_name VARCHAR(60) NOT NULL,
  value TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticket_id, column_name)
);

-- Step 5: Restore deprecation comments
COMMENT ON COLUMN tickets.evidence_state IS 'DEPRECATED (Phase 2): migrated to finance_ticket_operations.evidence_state. Retained for rollback.';
COMMENT ON COLUMN tickets.review_state IS 'DEPRECATED (Phase 2): migrated to finance_ticket_operations.review_state. Retained for rollback.';
COMMENT ON COLUMN tickets.kpi_objective IS 'DEPRECATED (Phase 2): migrated to finance_ticket_operations.kpi_objective. Retained for rollback.';
COMMENT ON COLUMN tickets.kpi_period IS 'DEPRECATED (Phase 2): migrated to finance_ticket_operations.kpi_period. Retained for rollback.';
COMMENT ON COLUMN tickets.baseline_assigned_at IS 'DEPRECATED (Phase 2): migrated to finance_ticket_operations.baseline_assigned_at. Retained for rollback.';
COMMENT ON COLUMN tickets.closed_by IS 'DEPRECATED (Phase 2): migrated to finance_ticket_operations.closed_by. Retained for rollback.';

COMMIT;