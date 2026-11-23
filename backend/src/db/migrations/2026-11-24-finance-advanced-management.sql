BEGIN;

CREATE TABLE IF NOT EXISTS finance_grading_band_configs(
 id BIGSERIAL PRIMARY KEY,
 name VARCHAR(80) NOT NULL,
 finance_function_id BIGINT REFERENCES finance_functions(id),
 excellent_threshold NUMERIC(5,2) NOT NULL DEFAULT 90,
 meets_expectations_threshold NUMERIC(5,2) NOT NULL DEFAULT 80,
 below_expectations_threshold NUMERIC(5,2) NOT NULL DEFAULT 60,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS finance_kpi_definitions(
 id BIGSERIAL PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 description TEXT,
 finance_function_id BIGINT REFERENCES finance_functions(id),
 target_value NUMERIC(12,2),
 unit VARCHAR(40),
 weight NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK(weight BETWEEN 0 AND 100),
 period_key VARCHAR(20) NOT NULL,
 grading_band_config_id BIGINT REFERENCES finance_grading_band_configs(id),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_by BIGINT NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ,
 UNIQUE(name,finance_function_id,period_key));
CREATE INDEX IF NOT EXISTS ix_kpi_def_function_period ON finance_kpi_definitions(finance_function_id,period_key) WHERE active=TRUE;

CREATE TABLE IF NOT EXISTS finance_corrective_action_plans(
 id BIGSERIAL PRIMARY KEY,
 employee_user_id BIGINT NOT NULL REFERENCES users(id),
 period_key VARCHAR(20) NOT NULL,
 description TEXT NOT NULL,
 target_improvement_score NUMERIC(5,2) NOT NULL,
 review_date DATE NOT NULL,
 mentor_user_id BIGINT REFERENCES users(id),
 status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK(status IN('active','completed','cancelled')),
 created_by BIGINT NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS finance_journal_workflow_chains(
 id BIGSERIAL PRIMARY KEY,
 finance_function VARCHAR(80) NOT NULL,
 work_item_type VARCHAR(20) NOT NULL DEFAULT 'journal' CHECK(work_item_type IN('journal','reconciliation','month_end')),
 confidentiality_level VARCHAR(40) NOT NULL DEFAULT 'Internal',
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_by BIGINT NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE UNIQUE INDEX IF NOT EXISTS ix_jwc_active_chain ON finance_journal_workflow_chains(finance_function,work_item_type,confidentiality_level) WHERE active=TRUE;

CREATE TABLE IF NOT EXISTS finance_journal_workflow_levels(
 id BIGSERIAL PRIMARY KEY,
 chain_id BIGINT NOT NULL REFERENCES finance_journal_workflow_chains(id) ON DELETE CASCADE,
 sequence_number INTEGER NOT NULL,
 reviewer_user_id BIGINT REFERENCES users(id),
 approver_user_id BIGINT REFERENCES users(id),
 backup_approver_user_id BIGINT REFERENCES users(id),
 level_name VARCHAR(80),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 UNIQUE(chain_id,sequence_number));

CREATE TABLE IF NOT EXISTS finance_delegated_authority(
 id BIGSERIAL PRIMARY KEY,
 delegator_user_id BIGINT NOT NULL REFERENCES users(id),
 delegate_user_id BIGINT NOT NULL REFERENCES users(id),
 scope VARCHAR(60) NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL CHECK(expires_at <= NOW() + INTERVAL '30 days'),
 reason TEXT NOT NULL,
 revoked_at TIMESTAMPTZ,
 revoked_by BIGINT REFERENCES users(id),
 revocation_reason TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS ix_da_delegate_active ON finance_delegated_authority(delegate_user_id) WHERE revoked_at IS NULL AND expires_at > NOW();

CREATE TABLE IF NOT EXISTS finance_journal_workflow_audits(
 id BIGSERIAL PRIMARY KEY,
 journal_id BIGINT NOT NULL,
 previous_status VARCHAR(30),
 new_status VARCHAR(30) NOT NULL,
 approval_level INTEGER,
 actor_user_id BIGINT NOT NULL REFERENCES users(id),
 action VARCHAR(30) NOT NULL CHECK(action IN('submit','approve','reject','return','resubmit','publish')),
 reason TEXT,
 delegation_id BIGINT REFERENCES finance_delegated_authority(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS ix_jwfa_journal_created ON finance_journal_workflow_audits(journal_id,created_at);

CREATE TABLE IF NOT EXISTS finance_email_allocation_rules(
 id BIGSERIAL PRIMARY KEY,
 finance_function VARCHAR(80),
 office_code VARCHAR(40),
 work_item_type VARCHAR(20),
 recipient_user_ids BIGINT[] NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_by BIGINT NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS finance_email_opt_outs(
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id),
 category VARCHAR(40) NOT NULL CHECK(category IN('reminders','allocations','escalations')),
 opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 opted_back_in_at TIMESTAMPTZ);
CREATE UNIQUE INDEX IF NOT EXISTS ix_email_opt_out_active ON finance_email_opt_outs(user_id,category) WHERE opted_back_in_at IS NULL;

CREATE TABLE IF NOT EXISTS finance_email_delivery_log(
 id BIGSERIAL PRIMARY KEY,
 rule_id BIGINT REFERENCES finance_email_allocation_rules(id),
 recipient_user_id BIGINT NOT NULL REFERENCES users(id),
 email_type VARCHAR(40) NOT NULL,
 task_id BIGINT,
 delivered BOOLEAN NOT NULL DEFAULT TRUE,
 status VARCHAR(20),
 sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS finance_feedback_entries(
 id BIGSERIAL PRIMARY KEY,
 thread_id BIGINT REFERENCES finance_feedback_entries(id),
 author_user_id BIGINT NOT NULL REFERENCES users(id),
 recipient_user_id BIGINT NOT NULL REFERENCES users(id),
 work_item_id BIGINT,
 work_item_type VARCHAR(20),
 period_key VARCHAR(20),
 remark_text TEXT NOT NULL,
 rating INTEGER CHECK(rating BETWEEN 1 AND 5),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS ix_feedback_thread ON finance_feedback_entries(thread_id,created_at);
CREATE INDEX IF NOT EXISTS ix_feedback_recipient ON finance_feedback_entries(recipient_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS finance_task_progress_updates(
 id BIGSERIAL PRIMARY KEY,
 task_id BIGINT NOT NULL,
 task_type VARCHAR(20) NOT NULL CHECK(task_type IN('ticket','journal','reconciliation','month_end')),
 previous_progress NUMERIC(5,2),
 new_progress NUMERIC(5,2) NOT NULL,
 previous_status VARCHAR(30),
 new_status VARCHAR(30),
 actor_user_id BIGINT NOT NULL REFERENCES users(id),
 reason TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS ix_tpu_task_created ON finance_task_progress_updates(task_id,task_type,created_at);

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS progress_percentage NUMERIC(5,2);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS partially_complete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS last_progress_update_at TIMESTAMPTZ;
ALTER TABLE finance_journals ADD COLUMN IF NOT EXISTS progress_percentage NUMERIC(5,2);
ALTER TABLE finance_journals ADD COLUMN IF NOT EXISTS partially_complete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE finance_journals ADD COLUMN IF NOT EXISTS last_progress_update_at TIMESTAMPTZ;
ALTER TABLE finance_reconciliations ADD COLUMN IF NOT EXISTS progress_percentage NUMERIC(5,2);
ALTER TABLE finance_reconciliations ADD COLUMN IF NOT EXISTS partially_complete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE finance_reconciliations ADD COLUMN IF NOT EXISTS last_progress_update_at TIMESTAMPTZ;
ALTER TABLE finance_close_tasks ADD COLUMN IF NOT EXISTS progress_percentage NUMERIC(5,2);
ALTER TABLE finance_close_tasks ADD COLUMN IF NOT EXISTS partially_complete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE finance_close_tasks ADD COLUMN IF NOT EXISTS last_progress_update_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS finance_time_tracking_entries(
 id BIGSERIAL PRIMARY KEY,
 task_id BIGINT NOT NULL,
 task_type VARCHAR(20) NOT NULL,
 user_id BIGINT NOT NULL REFERENCES users(id),
 start_time TIMESTAMPTZ NOT NULL,
 end_time TIMESTAMPTZ NOT NULL CHECK(end_time > start_time),
 duration_minutes INTEGER NOT NULL,
 description TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS ix_tte_user_task ON finance_time_tracking_entries(user_id,task_id,start_time DESC);

CREATE TABLE IF NOT EXISTS finance_it_service_surveys(
 id BIGSERIAL PRIMARY KEY,
 it_ticket_id BIGINT NOT NULL UNIQUE,
 finance_user_id BIGINT NOT NULL REFERENCES users(id),
 satisfaction_rating INTEGER NOT NULL CHECK(satisfaction_rating BETWEEN 1 AND 5),
 nps_score INTEGER NOT NULL CHECK(nps_score BETWEEN 0 AND 10),
 nps_classification VARCHAR(10) NOT NULL CHECK(nps_classification IN('Promoter','Passive','Detractor')),
 feedback_text TEXT,
 category_ratings JSONB,
 consent_to_identity BOOLEAN NOT NULL DEFAULT FALSE,
 submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS finance_distribution_lists(
 id BIGSERIAL PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 members TEXT[] NOT NULL,
 confidentiality_level VARCHAR(40) NOT NULL DEFAULT 'Internal',
 managed_by BIGINT NOT NULL REFERENCES users(id),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS finance_scheduled_reports(
 id BIGSERIAL PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 report_type VARCHAR(60) NOT NULL,
 parameters JSONB NOT NULL DEFAULT '{}',
 schedule_cron VARCHAR(60) NOT NULL,
 output_format VARCHAR(10) NOT NULL DEFAULT 'pdf' CHECK(output_format IN('pdf','xlsx','csv')),
 distribution_list_id BIGINT NOT NULL REFERENCES finance_distribution_lists(id),
 confidentiality_level VARCHAR(40) NOT NULL DEFAULT 'Internal',
 active BOOLEAN NOT NULL DEFAULT TRUE,
 last_run_at TIMESTAMPTZ,
 last_run_status VARCHAR(20),
 created_by BIGINT NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

INSERT INTO finance_grading_band_configs(name,finance_function_id,excellent_threshold,meets_expectations_threshold,below_expectations_threshold)
SELECT 'Default',NULL,90,80,60
WHERE NOT EXISTS (SELECT 1 FROM finance_grading_band_configs WHERE name='Default' AND finance_function_id IS NULL);

COMMIT;