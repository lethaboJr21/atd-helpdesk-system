BEGIN;
CREATE TABLE IF NOT EXISTS finance_mailbox_monitors(
 id BIGSERIAL PRIMARY KEY,mailbox_address TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,
 connection_state VARCHAR(30) NOT NULL DEFAULT 'not_configured',last_sync_at TIMESTAMPTZ,last_message_at TIMESTAMPTZ,
 processed_count BIGINT NOT NULL DEFAULT 0,rejected_count BIGINT NOT NULL DEFAULT 0,unattended_count BIGINT NOT NULL DEFAULT 0,failed_count BIGINT NOT NULL DEFAULT 0,
 active BOOLEAN NOT NULL DEFAULT TRUE,updated_by BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS finance_email_routing_rules(
 id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,mailbox_address TEXT,sender_pattern TEXT,subject_pattern TEXT,
 finance_function TEXT,owner_user_id BIGINT,priority VARCHAR(20) NOT NULL DEFAULT 'Medium',active BOOLEAN NOT NULL DEFAULT TRUE,
 sort_order INTEGER NOT NULL DEFAULT 100,created_by BIGINT,updated_by BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS finance_email_intake_exceptions(
 id BIGSERIAL PRIMARY KEY,message_id TEXT NOT NULL,conversation_id TEXT,sender_email TEXT,subject TEXT,mailbox_address TEXT,
 exception_type VARCHAR(50) NOT NULL,error_detail TEXT,status VARCHAR(25) NOT NULL DEFAULT 'open',ticket_id BIGINT,
 assigned_user_id BIGINT,finance_function TEXT,reprocess_count INTEGER NOT NULL DEFAULT 0,last_reprocessed_at TIMESTAMPTZ,
 resolution_reason TEXT,resolved_by BIGINT,resolved_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(message_id,exception_type));
CREATE TABLE IF NOT EXISTS finance_email_intake_actions(
 id BIGSERIAL PRIMARY KEY,exception_id BIGINT,action VARCHAR(40) NOT NULL,actor_user_id BIGINT,detail JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS ix_finance_email_exceptions_status ON finance_email_intake_exceptions(status,created_at DESC);
CREATE INDEX IF NOT EXISTS ix_finance_email_rules_active ON finance_email_routing_rules(active,sort_order);
COMMIT;
