BEGIN;
CREATE TABLE IF NOT EXISTS finance_offices (
 code VARCHAR(40) PRIMARY KEY,
 name VARCHAR(160) NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO finance_offices(code,name,active) VALUES
 ('MAIN_CFO','Finance Main and CFO Office',TRUE),
 ('AP','Accounts Payable Office',TRUE),
 ('BOARDROOM','Finance Boardroom',TRUE)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,active=TRUE,updated_at=NOW();
CREATE TABLE IF NOT EXISTS finance_employee_responsibilities (
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id),
 office_code VARCHAR(40) REFERENCES finance_offices(code),
 finance_function VARCHAR(80) NOT NULL DEFAULT 'General Finance Administration',
 manager_user_id BIGINT REFERENCES users(id),
 backup_user_id BIGINT REFERENCES users(id),
 availability_status VARCHAR(30) NOT NULL DEFAULT 'available',
 delegation_eligible BOOLEAN NOT NULL DEFAULT TRUE,
 is_finance_manager BOOLEAN NOT NULL DEFAULT FALSE,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_by BIGINT REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(user_id)
);
CREATE TABLE IF NOT EXISTS finance_mailboxes (
 id BIGSERIAL PRIMARY KEY,
 email TEXT UNIQUE NOT NULL,
 display_name VARCHAR(160) NOT NULL,
 office_code VARCHAR(40) REFERENCES finance_offices(code),
 finance_function VARCHAR(80),
 authorised BOOLEAN NOT NULL DEFAULT FALSE,
 authorisation_reason TEXT,
 default_group_id BIGINT REFERENCES support_groups(id),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_by BIGINT REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS finance_external_senders (
 id BIGSERIAL PRIMARY KEY,
 email TEXT UNIQUE NOT NULL,
 display_name VARCHAR(160),
 organisation VARCHAR(200),
 sender_type VARCHAR(40) NOT NULL DEFAULT 'unknown',
 verification_status VARCHAR(30) NOT NULL DEFAULT 'unverified',
 active BOOLEAN NOT NULL DEFAULT TRUE,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_by BIGINT REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS finance_ticket_operations (
 ticket_id BIGINT PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
 source_mailbox_id BIGINT REFERENCES finance_mailboxes(id),
 external_sender_id BIGINT REFERENCES finance_external_senders(id),
 triage_state VARCHAR(30) NOT NULL DEFAULT 'triage_required',
 acknowledged_at TIMESTAMPTZ,
 first_response_due_at TIMESTAMPTZ,
 first_response_at TIMESTAMPTZ,
 waiting_party VARCHAR(30),
 last_meaningful_update_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 finance_function VARCHAR(80),
 risk_level VARCHAR(20) NOT NULL DEFAULT 'normal',
 manager_instruction TEXT,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS finance_delegation_history (
 id BIGSERIAL PRIMARY KEY,
 ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
 actor_user_id BIGINT NOT NULL REFERENCES users(id),
 previous_assignee_id BIGINT REFERENCES users(id),
 new_assignee_id BIGINT REFERENCES users(id),
 reason TEXT NOT NULL,
 previous_priority VARCHAR(30),
 new_priority VARCHAR(30),
 previous_due_at TIMESTAMPTZ,
 new_due_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE finance_mailboxes ADD COLUMN IF NOT EXISTS monitoring_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE finance_mailboxes ADD COLUMN IF NOT EXISTS default_assignee_id BIGINT REFERENCES users(id);
ALTER TABLE finance_mailboxes ADD COLUMN IF NOT EXISTS backup_assignee_id BIGINT REFERENCES users(id);
ALTER TABLE finance_mailboxes ADD COLUMN IF NOT EXISTS default_priority VARCHAR(30) NOT NULL DEFAULT 'Medium';
ALTER TABLE finance_mailboxes ADD COLUMN IF NOT EXISTS first_response_minutes INTEGER NOT NULL DEFAULT 1440;
ALTER TABLE finance_mailboxes ADD COLUMN IF NOT EXISTS due_minutes INTEGER;
ALTER TABLE finance_mailboxes ADD COLUMN IF NOT EXISTS sender_scope VARCHAR(30) NOT NULL DEFAULT 'internal_and_external';
ALTER TABLE finance_external_senders ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE finance_external_senders ADD COLUMN IF NOT EXISTS finance_function VARCHAR(80);
ALTER TABLE finance_external_senders ADD COLUMN IF NOT EXISTS governance_notes TEXT;
ALTER TABLE finance_external_senders ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS intake_id BIGINT REFERENCES email_ticket_intake(id);
ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS sender_classification VARCHAR(40);
ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS external_organisation VARCHAR(200);
ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS unattended_since TIMESTAMPTZ;
ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS routed_by_rule BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS finance_mailboxes_monitoring_idx ON finance_mailboxes(authorised,monitoring_enabled,active);
CREATE INDEX IF NOT EXISTS finance_external_senders_domain_idx ON finance_external_senders(domain,verification_status,active);CREATE INDEX IF NOT EXISTS finance_ticket_operations_triage_idx ON finance_ticket_operations(triage_state,first_response_due_at);
CREATE INDEX IF NOT EXISTS finance_delegation_ticket_idx ON finance_delegation_history(ticket_id,created_at DESC);
COMMIT;
