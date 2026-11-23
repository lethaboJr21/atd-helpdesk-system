-- ============================================================================
-- Migration: Phase 1 — Workspace Discipline (ROLLBACK)
-- Phase: 1
-- Purpose: Reverse Phase 1 migration — drop trigger, drop constraints,
--          restore original workspace values from backup, drop denormalised
--          workspace columns from ticket_history and ticket_comments.
-- Spec ref: spec §5.1; design §2.4.1
-- Idempotency: DROP IF EXISTS for all objects
-- Prerequisite: tickets_workspace_backup table must exist (created by Phase 1)
-- ============================================================================

BEGIN;

-- Step 1: Drop normalisation trigger and function
DROP TRIGGER IF EXISTS trg_normalise_ticket_workspace ON tickets;
DROP FUNCTION IF EXISTS normalise_ticket_workspace();

-- Step 2: Drop FK constraint
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_workspace_valid_code;

-- Step 3: Drop NOT NULL constraint
ALTER TABLE tickets ALTER COLUMN workspace DROP NOT NULL;

-- Step 4: Restore original workspace values from backup
UPDATE tickets t SET workspace = b.original_workspace
  FROM tickets_workspace_backup b WHERE b.id = t.id;

-- Step 5: Drop denormalised workspace columns from ticket_history
ALTER TABLE ticket_history DROP COLUMN IF EXISTS workspace;

-- Step 6: Drop denormalised workspace columns from ticket_comments
ALTER TABLE ticket_comments DROP COLUMN IF EXISTS workspace;

-- Step 7: Drop workspace indexes
DROP INDEX IF EXISTS ix_tickets_workspace;
DROP INDEX IF EXISTS ix_ticket_history_workspace;
DROP INDEX IF EXISTS ix_ticket_comments_workspace;

COMMIT;