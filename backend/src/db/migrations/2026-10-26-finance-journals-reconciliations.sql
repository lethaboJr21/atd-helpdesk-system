BEGIN;
CREATE TABLE IF NOT EXISTS finance_journals(
 id BIGSERIAL PRIMARY KEY,journal_reference TEXT NOT NULL UNIQUE,entity TEXT NOT NULL,accounting_period VARCHAR(7) NOT NULL,
 journal_type TEXT NOT NULL,description TEXT NOT NULL,business_justification TEXT,currency VARCHAR(3) NOT NULL DEFAULT 'ZAR',
 debit_total NUMERIC(18,2) NOT NULL DEFAULT 0,credit_total NUMERIC(18,2) NOT NULL DEFAULT 0,status VARCHAR(30) NOT NULL DEFAULT 'draft',
 preparer_user_id BIGINT NOT NULL,reviewer_user_id BIGINT,approver_user_id BIGINT,due_at TIMESTAMPTZ,related_ticket_id BIGINT,
 recurring BOOLEAN NOT NULL DEFAULT FALSE,priority VARCHAR(20) NOT NULL DEFAULT 'Medium',submitted_at TIMESTAMPTZ,reviewed_at TIMESTAMPTZ,
 approved_at TIMESTAMPTZ,posted_at TIMESTAMPTZ,rejection_reason TEXT,return_reason TEXT,reversal_of_id BIGINT,
 created_by BIGINT NOT NULL,updated_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(debit_total>=0 AND credit_total>=0));
CREATE TABLE IF NOT EXISTS finance_journal_lines(
 id BIGSERIAL PRIMARY KEY,journal_id BIGINT NOT NULL REFERENCES finance_journals(id) ON DELETE CASCADE,line_number INTEGER NOT NULL,
 account_code TEXT NOT NULL,cost_centre TEXT,description TEXT,debit NUMERIC(18,2) NOT NULL DEFAULT 0,credit NUMERIC(18,2) NOT NULL DEFAULT 0,
 tax_treatment TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(journal_id,line_number),CHECK(debit>=0 AND credit>=0),CHECK(NOT(debit>0 AND credit>0)));
CREATE TABLE IF NOT EXISTS finance_reconciliations(
 id BIGSERIAL PRIMARY KEY,reconciliation_reference TEXT NOT NULL UNIQUE,entity TEXT NOT NULL,account_code TEXT NOT NULL,
 control_name TEXT NOT NULL,accounting_period VARCHAR(7) NOT NULL,owner_user_id BIGINT NOT NULL,reviewer_user_id BIGINT,approver_user_id BIGINT,
 ledger_balance NUMERIC(18,2) NOT NULL DEFAULT 0,supporting_balance NUMERIC(18,2) NOT NULL DEFAULT 0,variance NUMERIC(18,2) NOT NULL DEFAULT 0,
 outstanding_items INTEGER NOT NULL DEFAULT 0,status VARCHAR(30) NOT NULL DEFAULT 'draft',due_at TIMESTAMPTZ,reviewed_at TIMESTAMPTZ,
 approved_at TIMESTAMPTZ,return_reason TEXT,rejection_reason TEXT,created_by BIGINT NOT NULL,updated_by BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS finance_approval_actions(
 id BIGSERIAL PRIMARY KEY,record_type VARCHAR(30) NOT NULL,record_id BIGINT NOT NULL,action VARCHAR(40) NOT NULL,
 from_status VARCHAR(30),to_status VARCHAR(30),reason TEXT,actor_user_id BIGINT NOT NULL,detail JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS finance_record_evidence(
 id BIGSERIAL PRIMARY KEY,record_type VARCHAR(30) NOT NULL,record_id BIGINT NOT NULL,attachment_id BIGINT,evidence_name TEXT,
 evidence_reference TEXT,required BOOLEAN NOT NULL DEFAULT FALSE,review_status VARCHAR(25) NOT NULL DEFAULT 'pending',uploaded_by BIGINT,
 uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS ix_finance_journals_period_status ON finance_journals(accounting_period,status);
CREATE INDEX IF NOT EXISTS ix_finance_reconciliations_period_status ON finance_reconciliations(accounting_period,status);
CREATE INDEX IF NOT EXISTS ix_finance_approval_actions_record ON finance_approval_actions(record_type,record_id,created_at DESC);
COMMIT;
