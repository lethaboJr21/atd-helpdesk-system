BEGIN;
CREATE TABLE IF NOT EXISTS finance_approval_routing_rules(
 id BIGSERIAL PRIMARY KEY,
 finance_function VARCHAR(60) NOT NULL,
 work_item_type VARCHAR(20) NOT NULL DEFAULT 'any' CHECK(work_item_type IN('any','ticket','journal','reconciliation','month_end')),
 value_threshold_min NUMERIC(18,2),
 value_threshold_max NUMERIC(18,2),
 confidentiality_level VARCHAR(40) DEFAULT 'Internal',
 reviewer_user_id BIGINT,
 approver_user_id BIGINT,
 backup_approver_user_id BIGINT,
 approver_policy VARCHAR(30) NOT NULL DEFAULT 'finance_manager' CHECK(approver_policy IN('finance_manager','ap_manager','cfo','escalation_queue')),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_by BIGINT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS finance_extension_requests(
 id BIGSERIAL PRIMARY KEY,
 work_item_id BIGINT NOT NULL,
 work_item_type VARCHAR(20) NOT NULL CHECK(work_item_type IN('ticket','journal','reconciliation','month_end')),
 requested_due_at TIMESTAMPTZ NOT NULL,
 reason TEXT NOT NULL CHECK(LENGTH(reason)>=5),
 dependency_type VARCHAR(30) DEFAULT 'internal',
 status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),
 approver_user_id BIGINT,
 approved_due_at TIMESTAMPTZ,
 original_due_at TIMESTAMPTZ,
 requested_by BIGINT NOT NULL,
 decided_at TIMESTAMPTZ,
 rejection_reason TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS finance_review_exemptions(
 id BIGSERIAL PRIMARY KEY,
 work_item_id BIGINT NOT NULL,
 work_item_type VARCHAR(20) NOT NULL CHECK(work_item_type IN('ticket','journal','reconciliation','month_end')),
 reason TEXT NOT NULL CHECK(LENGTH(reason)>=5),
 approver_user_id BIGINT NOT NULL,
 granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 revoked_at TIMESTAMPTZ,
 revoked_by BIGINT,
 revocation_reason TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE INDEX IF NOT EXISTS ix_finance_approval_routing_active ON finance_approval_routing_rules(finance_function,active);
CREATE INDEX IF NOT EXISTS ix_finance_approval_routing_confidentiality ON finance_approval_routing_rules(confidentiality_level,active);
CREATE INDEX IF NOT EXISTS ix_finance_extension_requests_work ON finance_extension_requests(work_item_id,work_item_type,status);
CREATE INDEX IF NOT EXISTS ix_finance_extension_requests_status ON finance_extension_requests(status,requested_due_at);
CREATE INDEX IF NOT EXISTS ix_finance_review_exemptions_work ON finance_review_exemptions(work_item_id,work_item_type) WHERE revoked_at IS NULL;
COMMIT;