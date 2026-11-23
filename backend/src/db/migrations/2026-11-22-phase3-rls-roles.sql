-- ============================================================================
-- Migration: Phase 3 — Row-Level Security + Database Roles
-- Phase: 3
-- Purpose: Create 8 database roles + system_administrator, GRANT explicit
--          privileges, enable + FORCE RLS on shared tables, create
--          session-variable-driven RLS policies.
-- Spec ref: spec §5.3, §5.4; design §2.4.3
-- Idempotency: DO $$ IF NOT EXISTS $$ guards for roles, DROP POLICY IF EXISTS
--              before CREATE POLICY
-- Rollback: 2026-11-22-phase3-rls-roles-rollback.sql
-- Prerequisite: Phase 1 complete (denormalised workspace on history/comments)
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Create database roles (idempotent)
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finance_reader') THEN
    CREATE ROLE finance_reader NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finance_writer') THEN
    CREATE ROLE finance_writer NOLOGIN IN ROLE finance_reader;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'it_reader') THEN
    CREATE ROLE it_reader NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'it_writer') THEN
    CREATE ROLE it_writer NOLOGIN IN ROLE it_reader;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pdm_reader') THEN
    CREATE ROLE pdm_reader NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pdm_writer') THEN
    CREATE ROLE pdm_writer NOLOGIN IN ROLE pdm_reader;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shared_reader') THEN
    CREATE ROLE shared_reader NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'helpdesk_admin') THEN
    CREATE ROLE helpdesk_admin NOLOGIN;
  END IF;
END $$;

-- System Administrator role with BYPASSRLS (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'system_administrator') THEN
    CREATE ROLE system_administrator NOLOGIN BYPASSRLS;
  END IF;
END $$;

-- ============================================================================
-- Step 2: GRANT privileges (explicit, no wildcards) [spec §5.4.1 rule 8]
-- ============================================================================

-- Finance reader: SELECT on finance_* tables + shared tables
GRANT SELECT ON finance_ticket_operations, finance_offices, finance_mailboxes,
  finance_external_senders, finance_employee_responsibilities, finance_delegation_history,
  finance_journals, finance_reconciliations, finance_close_tasks, finance_kpi_item_scores,
  finance_kpi_objectives, finance_kpis TO finance_reader;
GRANT SELECT ON tickets, ticket_history, ticket_comments, ticket_attachments,
  email_ticket_intake TO finance_reader;

-- Finance writer: INSERT/UPDATE/DELETE on finance_* + INSERT/UPDATE on shared
GRANT INSERT, UPDATE, DELETE ON finance_ticket_operations, finance_delegation_history,
  finance_journals, finance_reconciliations, finance_close_tasks TO finance_writer;
GRANT INSERT, UPDATE ON tickets, ticket_history, ticket_comments TO finance_writer;

-- IT reader: SELECT on IT-specific tables + shared tables
GRANT SELECT ON asset_health, request_routing_rules TO it_reader;
GRANT SELECT ON tickets, ticket_history, ticket_comments, ticket_attachments,
  email_ticket_intake TO it_reader;

-- IT writer: INSERT/UPDATE on shared tables
GRANT INSERT, UPDATE ON tickets, ticket_history, ticket_comments TO it_writer;

-- PDM reader: SELECT on shared tables
GRANT SELECT ON tickets, ticket_history, ticket_comments, ticket_attachments,
  email_ticket_intake TO pdm_reader;

-- PDM writer: INSERT/UPDATE on shared tables
GRANT INSERT, UPDATE ON tickets, ticket_history, ticket_comments TO pdm_writer;

-- Shared reader: SELECT on tables without RLS
GRANT SELECT ON users, service_workspaces, support_groups, notifications TO shared_reader;

-- Helpdesk admin: DDL privileges, NO BYPASSRLS [DDR-10]
-- PostgreSQL only supports CREATE and USAGE for schema-level grants
GRANT CREATE, USAGE ON SCHEMA public TO helpdesk_admin;

-- ============================================================================
-- Step 3: Ensure workspace column on ticket_attachments and email_ticket_intake
-- ============================================================================
ALTER TABLE ticket_attachments ADD COLUMN IF NOT EXISTS workspace VARCHAR(50);

UPDATE ticket_attachments a SET workspace = t.workspace
  FROM tickets t WHERE t.id = a.ticket_id AND a.workspace IS NULL;

UPDATE ticket_attachments SET workspace = 'IT' WHERE workspace IS NULL;

ALTER TABLE ticket_attachments ALTER COLUMN workspace SET NOT NULL;

CREATE INDEX IF NOT EXISTS ix_ticket_attachments_workspace ON ticket_attachments(workspace);

ALTER TABLE email_ticket_intake ADD COLUMN IF NOT EXISTS workspace VARCHAR(50);

UPDATE email_ticket_intake e SET workspace = t.workspace
  FROM tickets t WHERE t.id = e.ticket_id AND e.workspace IS NULL AND t.id IS NOT NULL;

UPDATE email_ticket_intake SET workspace = 'IT' WHERE workspace IS NULL;

ALTER TABLE email_ticket_intake ALTER COLUMN workspace SET NOT NULL;

CREATE INDEX IF NOT EXISTS ix_email_ticket_intake_workspace ON email_ticket_intake(workspace);

-- ============================================================================
-- Step 4: Enable RLS on shared tables [spec §5.3.1 rule 1]
-- ============================================================================
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_ticket_intake ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 5: FORCE RLS on critical tables [spec §5.3.1 rule 2]
-- ============================================================================
ALTER TABLE tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket_history FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments FORCE ROW LEVEL SECURITY;

ALTER TABLE email_ticket_intake FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 6: Create RLS policies (session-variable-driven) [spec §5.3.1 rule 5]
-- ============================================================================

-- ---- tickets policies ----
-- Finance reader
DROP POLICY IF EXISTS finance_reader_tickets_isolation ON tickets;
CREATE POLICY finance_reader_tickets_isolation ON tickets
  FOR SELECT TO finance_reader
  USING (workspace = current_setting('app.workspace', true));

-- Finance writer
DROP POLICY IF EXISTS finance_writer_tickets_select ON tickets;
CREATE POLICY finance_writer_tickets_select ON tickets
  FOR SELECT TO finance_writer
  USING (workspace = current_setting('app.workspace', true));

DROP POLICY IF EXISTS finance_writer_tickets_insert ON tickets;
CREATE POLICY finance_writer_tickets_insert ON tickets
  FOR INSERT TO finance_writer
  WITH CHECK (workspace = current_setting('app.workspace', true));

DROP POLICY IF EXISTS finance_writer_tickets_update ON tickets;
CREATE POLICY finance_writer_tickets_update ON tickets
  FOR UPDATE TO finance_writer
  USING (workspace = current_setting('app.workspace', true))
  WITH CHECK (workspace = current_setting('app.workspace', true));

-- IT reader
DROP POLICY IF EXISTS it_reader_tickets_isolation ON tickets;
CREATE POLICY it_reader_tickets_isolation ON tickets
  FOR SELECT TO it_reader
  USING (workspace = current_setting('app.workspace', true));

-- IT writer
DROP POLICY IF EXISTS it_writer_tickets_insert ON tickets;
CREATE POLICY it_writer_tickets_insert ON tickets
  FOR INSERT TO it_writer
  WITH CHECK (workspace = current_setting('app.workspace', true));

DROP POLICY IF EXISTS it_writer_tickets_update ON tickets;
CREATE POLICY it_writer_tickets_update ON tickets
  FOR UPDATE TO it_writer
  USING (workspace = current_setting('app.workspace', true))
  WITH CHECK (workspace = current_setting('app.workspace', true));

-- PDM reader
DROP POLICY IF EXISTS pdm_reader_tickets_isolation ON tickets;
CREATE POLICY pdm_reader_tickets_isolation ON tickets
  FOR SELECT TO pdm_reader
  USING (workspace = current_setting('app.workspace', true));

-- PDM writer
DROP POLICY IF EXISTS pdm_writer_tickets_insert ON tickets;
CREATE POLICY pdm_writer_tickets_insert ON tickets
  FOR INSERT TO pdm_writer
  WITH CHECK (workspace = current_setting('app.workspace', true));

DROP POLICY IF EXISTS pdm_writer_tickets_update ON tickets;
CREATE POLICY pdm_writer_tickets_update ON tickets
  FOR UPDATE TO pdm_writer
  USING (workspace = current_setting('app.workspace', true))
  WITH CHECK (workspace = current_setting('app.workspace', true));

-- ---- ticket_history policies (uses denormalised workspace from Phase 1) ----
DROP POLICY IF EXISTS workspace_isolation_ticket_history ON ticket_history;
CREATE POLICY workspace_isolation_ticket_history ON ticket_history
  FOR ALL TO finance_reader, finance_writer, it_reader, it_writer, pdm_reader, pdm_writer
  USING (workspace = current_setting('app.workspace', true))
  WITH CHECK (workspace = current_setting('app.workspace', true));

-- ---- ticket_comments policies ----
DROP POLICY IF EXISTS workspace_isolation_ticket_comments ON ticket_comments;
CREATE POLICY workspace_isolation_ticket_comments ON ticket_comments
  FOR ALL TO finance_reader, finance_writer, it_reader, it_writer, pdm_reader, pdm_writer
  USING (workspace = current_setting('app.workspace', true))
  WITH CHECK (workspace = current_setting('app.workspace', true));

-- ---- ticket_attachments policies ----
DROP POLICY IF EXISTS workspace_isolation_ticket_attachments ON ticket_attachments;
CREATE POLICY workspace_isolation_ticket_attachments ON ticket_attachments
  FOR ALL TO finance_reader, finance_writer, it_reader, it_writer, pdm_reader, pdm_writer
  USING (workspace = current_setting('app.workspace', true))
  WITH CHECK (workspace = current_setting('app.workspace', true));

-- ---- email_ticket_intake policies ----
DROP POLICY IF EXISTS workspace_isolation_email_ticket_intake ON email_ticket_intake;
CREATE POLICY workspace_isolation_email_ticket_intake ON email_ticket_intake
  FOR ALL TO finance_reader, finance_writer, it_reader, it_writer, pdm_reader, pdm_writer
  USING (workspace = current_setting('app.workspace', true))
  WITH CHECK (workspace = current_setting('app.workspace', true));

-- ============================================================================
-- Step 7: Policy comments [spec §4.4.1]
-- ============================================================================
COMMENT ON POLICY finance_reader_tickets_isolation ON tickets IS
  'Finance reader workspace isolation: only rows where workspace = app.workspace. Role: finance_reader.';
COMMENT ON POLICY finance_writer_tickets_select ON tickets IS
  'Finance writer SELECT isolation: only rows where workspace = app.workspace. Role: finance_writer.';
COMMENT ON POLICY finance_writer_tickets_insert ON tickets IS
  'Finance writer INSERT: only rows where workspace = app.workspace. Role: finance_writer.';
COMMENT ON POLICY finance_writer_tickets_update ON tickets IS
  'Finance writer UPDATE: only rows where workspace = app.workspace. Role: finance_writer.';
COMMENT ON POLICY it_reader_tickets_isolation ON tickets IS
  'IT reader workspace isolation: only rows where workspace = app.workspace. Role: it_reader.';
COMMENT ON POLICY it_writer_tickets_insert ON tickets IS
  'IT writer INSERT: only rows where workspace = app.workspace. Role: it_writer.';
COMMENT ON POLICY it_writer_tickets_update ON tickets IS
  'IT writer UPDATE: only rows where workspace = app.workspace. Role: it_writer.';
COMMENT ON POLICY pdm_reader_tickets_isolation ON tickets IS
  'PDM reader workspace isolation: only rows where workspace = app.workspace. Role: pdm_reader.';
COMMENT ON POLICY pdm_writer_tickets_insert ON tickets IS
  'PDM writer INSERT: only rows where workspace = app.workspace. Role: pdm_writer.';
COMMENT ON POLICY pdm_writer_tickets_update ON tickets IS
  'PDM writer UPDATE: only rows where workspace = app.workspace. Role: pdm_writer.';
COMMENT ON POLICY workspace_isolation_ticket_history ON ticket_history IS
  'Workspace isolation for ticket_history (all roles): workspace = app.workspace. Uses denormalised workspace from Phase 1.';
COMMENT ON POLICY workspace_isolation_ticket_comments ON ticket_comments IS
  'Workspace isolation for ticket_comments (all roles): workspace = app.workspace. Uses denormalised workspace from Phase 1.';
COMMENT ON POLICY workspace_isolation_ticket_attachments ON ticket_attachments IS
  'Workspace isolation for ticket_attachments (all roles): workspace = app.workspace.';
COMMENT ON POLICY workspace_isolation_email_ticket_intake ON email_ticket_intake IS
  'Workspace isolation for email_ticket_intake (all roles): workspace = app.workspace.';

COMMIT;