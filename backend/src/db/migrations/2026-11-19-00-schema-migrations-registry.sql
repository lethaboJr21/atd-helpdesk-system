-- ============================================================================
-- Migration: schema_migrations registry table
-- Phase: 0 (Migration Infrastructure Foundation)
-- Purpose: Create the schema_migrations registry table to track all subsequent
--          phase migrations with filename, phase, validation status, checksum,
--          and rollback filename. This table is a prerequisite for the enhanced
--          runMigration.js runner (Task 1.3) and migrationValidator.js (Task 1.2).
-- Spec ref: spec §6.6, §5.7.1 rule 7; design §2.6
-- Idempotency: CREATE TABLE IF NOT EXISTS — safe to run multiple times.
-- Rollback: DROP TABLE IF EXISTS schema_migrations;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id BIGSERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  phase INTEGER NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validation_status VARCHAR(20) NOT NULL CHECK (
    validation_status IN ('pending', 'passed', 'failed', 'rolled_back')
  ),
  checksum VARCHAR(64),
  rollback_filename VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS ix_schema_migrations_filename
  ON schema_migrations (filename);

CREATE INDEX IF NOT EXISTS ix_schema_migrations_phase
  ON schema_migrations (phase);

COMMIT;