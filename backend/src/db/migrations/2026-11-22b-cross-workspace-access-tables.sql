-- ============================================================================
-- Migration: Cross-Workspace Access Governance Tables
-- Phase: 3b (companion to Phase 3 RLS+Roles)
-- Purpose: Create tables for governed, audited cross-workspace access with
--          mandatory expiry (max 90 days) and revocation support.
--
-- Spec ref: spec §5.6; design §2.5, §2.2.2.6–2.2.2.8, §2.1.3.4
-- Idempotency: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS
-- Rollback: 2026-11-22b-cross-workspace-access-tables-rollback.sql
-- Prerequisite: Phase 1 (canonical workspace codes), users table exists
-- ============================================================================

BEGIN;

-- Step 1: Cross-workspace access exceptions table
--         Records a time-limited grant allowing a user to access resources
--         in a workspace outside their primary workspace.
CREATE TABLE IF NOT EXISTS cross_workspace_access_exceptions (
  id              BIGSERIAL    PRIMARY KEY,
  grantor_user_id BIGINT       NOT NULL REFERENCES users(id),
  grantee_user_id BIGINT       NOT NULL REFERENCES users(id),
  target_workspace VARCHAR(50) NOT NULL,
  expires_at      TIMESTAMPTZ  NOT NULL,
  revoked_at      TIMESTAMPTZ,
  reason          TEXT         NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT cwa_expires_after_created  CHECK (expires_at > created_at),
  CONSTRAINT cwa_expires_within_90_days CHECK (expires_at <= created_at + INTERVAL '90 days'),
  CONSTRAINT cwa_target_workspace_not_empty CHECK (length(trim(target_workspace)) > 0)
);

-- Step 2: Cross-workspace access audit log
--         Records every cross-workspace access attempt (allowed or denied).
CREATE TABLE IF NOT EXISTS cross_workspace_access_log (
  id               BIGSERIAL    PRIMARY KEY,
  user_id          BIGINT       NOT NULL REFERENCES users(id),
  source_workspace VARCHAR(50)  NOT NULL,
  target_workspace VARCHAR(50)  NOT NULL,
  resource_type    VARCHAR(50)  NOT NULL,
  resource_id      BIGINT,
  exception_id     BIGINT       REFERENCES cross_workspace_access_exceptions(id),
  accessed_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  reason           TEXT
);

-- Step 3: Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS ix_cwa_exceptions_grantee
  ON cross_workspace_access_exceptions (grantee_user_id);

CREATE INDEX IF NOT EXISTS ix_cwa_exceptions_grantee_active
  ON cross_workspace_access_exceptions (grantee_user_id, target_workspace)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_cwa_exceptions_target
  ON cross_workspace_access_exceptions (target_workspace);

CREATE INDEX IF NOT EXISTS ix_cwa_log_user_time
  ON cross_workspace_access_log (user_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS ix_cwa_log_exception
  ON cross_workspace_access_log (exception_id)
  WHERE exception_id IS NOT NULL;

-- Step 4: Comments
COMMENT ON TABLE cross_workspace_access_exceptions IS
  'Time-limited grants allowing a user to access resources in a workspace outside their primary workspace. Max expiry 90 days. Revocable.';
COMMENT ON TABLE cross_workspace_access_log IS
  'Audit log of every cross-workspace access attempt. exception_id is NULL for denied attempts.';
COMMENT ON COLUMN cross_workspace_access_exceptions.expires_at IS 'Mandatory expiry timestamp. Must be > created_at and <= created_at + 90 days.';
COMMENT ON COLUMN cross_workspace_access_exceptions.revoked_at IS 'Set when the exception is manually revoked. NULL means active.';
COMMENT ON COLUMN cross_workspace_access_log.exception_id IS 'References the exception that authorised this access. NULL for denied attempts.';

COMMIT;