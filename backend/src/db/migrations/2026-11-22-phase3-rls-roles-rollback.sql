-- ============================================================================
-- Migration: Phase 3 — RLS + Database Roles (ROLLBACK)
-- Phase: 3
-- Purpose: Reverse Phase 3 — drop RLS policies, disable RLS, drop roles,
--          drop workspace columns from ticket_attachments and email_ticket_intake.
-- Spec ref: spec §5.3, §5.4; design §2.4.3
-- Idempotency: DROP POLICY IF EXISTS, DROP ROLE IF EXISTS
-- ============================================================================

BEGIN;

-- Step 1: Drop all RLS policies
DROP POLICY IF EXISTS finance_reader_tickets_isolation ON tickets;
DROP POLICY IF EXISTS finance_writer_tickets_select ON tickets;
DROP POLICY IF EXISTS finance_writer_tickets_insert ON tickets;
DROP POLICY IF EXISTS finance_writer_tickets_update ON tickets;
DROP POLICY IF EXISTS it_reader_tickets_isolation ON tickets;
DROP POLICY IF EXISTS it_writer_tickets_insert ON tickets;
DROP POLICY IF EXISTS it_writer_tickets_update ON tickets;
DROP POLICY IF EXISTS pdm_reader_tickets_isolation ON tickets;
DROP POLICY IF EXISTS pdm_writer_tickets_insert ON tickets;
DROP POLICY IF EXISTS pdm_writer_tickets_update ON tickets;
DROP POLICY IF EXISTS workspace_isolation_ticket_history ON ticket_history;
DROP POLICY IF EXISTS workspace_isolation_ticket_comments ON ticket_comments;
DROP POLICY IF EXISTS workspace_isolation_ticket_attachments ON ticket_attachments;
DROP POLICY IF EXISTS workspace_isolation_email_ticket_intake ON email_ticket_intake;

-- Step 2: Disable and unforce RLS
ALTER TABLE tickets NO FORCE ROW LEVEL SECURITY;
ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_history NO FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments NO FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments NO FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_ticket_intake NO FORCE ROW LEVEL SECURITY;
ALTER TABLE email_ticket_intake DISABLE ROW LEVEL SECURITY;

-- Step 3: Drop workspace indexes from Phase 3
DROP INDEX IF EXISTS ix_ticket_attachments_workspace;
DROP INDEX IF EXISTS ix_email_ticket_intake_workspace;

-- Step 4: Drop workspace columns added in Phase 3
ALTER TABLE ticket_attachments DROP COLUMN IF EXISTS workspace;
ALTER TABLE email_ticket_intake DROP COLUMN IF EXISTS workspace;

-- Step 5: Revoke grants (best effort)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM finance_reader;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM finance_writer;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM it_reader;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM it_writer;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM pdm_reader;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM pdm_writer;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM shared_reader;
REVOKE CREATE, USAGE ON SCHEMA public FROM helpdesk_admin;

-- Step 6: Drop roles (child roles first)
DROP ROLE IF EXISTS finance_writer;
DROP ROLE IF EXISTS finance_reader;
DROP ROLE IF EXISTS it_writer;
DROP ROLE IF EXISTS it_reader;
DROP ROLE IF EXISTS pdm_writer;
DROP ROLE IF EXISTS pdm_reader;
DROP ROLE IF EXISTS shared_reader;
DROP ROLE IF EXISTS helpdesk_admin;
DROP ROLE IF EXISTS system_administrator;

COMMIT;