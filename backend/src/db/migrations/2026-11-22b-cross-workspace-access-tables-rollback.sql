-- ============================================================================
-- Rollback: Cross-Workspace Access Governance Tables
-- Reverses: 2026-11-22b-cross-workspace-access-tables.sql
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS cross_workspace_access_log;
DROP TABLE IF EXISTS cross_workspace_access_exceptions;

COMMIT;