BEGIN;
CREATE TABLE IF NOT EXISTS finance_close_periods(
 id BIGSERIAL PRIMARY KEY,period_key VARCHAR(7) NOT NULL UNIQUE,status VARCHAR(25) NOT NULL DEFAULT 'open',opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 target_close_at TIMESTAMPTZ,closed_at TIMESTAMPTZ,opened_by BIGINT NOT NULL,closed_by BIGINT,notes TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS finance_close_task_templates(
 id BIGSERIAL PRIMARY KEY,task_code TEXT NOT NULL UNIQUE,title TEXT NOT NULL,description TEXT,workstream TEXT NOT NULL,finance_function TEXT,
 recurrence VARCHAR(25) NOT NULL DEFAULT 'monthly',default_owner_user_id BIGINT,default_backup_user_id BIGINT,default_weight NUMERIC(6,2) NOT NULL DEFAULT 0,
 due_day INTEGER,requires_evidence BOOLEAN NOT NULL DEFAULT TRUE,requires_review BOOLEAN NOT NULL DEFAULT TRUE,active BOOLEAN NOT NULL DEFAULT TRUE,
 created_by BIGINT NOT NULL,updated_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(default_weight BETWEEN 0 AND 100),CHECK(due_day IS NULL OR due_day BETWEEN 1 AND 31));
CREATE TABLE IF NOT EXISTS finance_close_tasks(
 id BIGSERIAL PRIMARY KEY,period_id BIGINT NOT NULL REFERENCES finance_close_periods(id),template_id BIGINT REFERENCES finance_close_task_templates(id),
 task_reference TEXT NOT NULL UNIQUE,title TEXT NOT NULL,description TEXT,workstream TEXT NOT NULL,finance_function TEXT,owner_user_id BIGINT,
 backup_user_id BIGINT,weight NUMERIC(6,2) NOT NULL DEFAULT 0,progress_percent NUMERIC(6,2) NOT NULL DEFAULT 0,status VARCHAR(30) NOT NULL DEFAULT 'not_started',
 due_at TIMESTAMPTZ,requires_evidence BOOLEAN NOT NULL DEFAULT TRUE,requires_review BOOLEAN NOT NULL DEFAULT TRUE,reviewer_user_id BIGINT,
 review_status VARCHAR(25) NOT NULL DEFAULT 'pending',return_reason TEXT,completed_at TIMESTAMPTZ,reviewed_at TIMESTAMPTZ,
 created_by BIGINT NOT NULL,updated_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(period_id,template_id),CHECK(weight BETWEEN 0 AND 100),CHECK(progress_percent BETWEEN 0 AND 100));
CREATE TABLE IF NOT EXISTS finance_close_task_actions(
 id BIGSERIAL PRIMARY KEY,task_id BIGINT NOT NULL REFERENCES finance_close_tasks(id),action VARCHAR(40) NOT NULL,from_status VARCHAR(30),to_status VARCHAR(30),
 reason TEXT,actor_user_id BIGINT NOT NULL,detail JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS finance_close_task_evidence(
 id BIGSERIAL PRIMARY KEY,task_id BIGINT NOT NULL REFERENCES finance_close_tasks(id),attachment_id BIGINT,evidence_name TEXT,evidence_reference TEXT,
 review_status VARCHAR(25) NOT NULL DEFAULT 'pending',review_comment TEXT,uploaded_by BIGINT NOT NULL,reviewed_by BIGINT,uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),reviewed_at TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS ix_finance_close_tasks_period_status ON finance_close_tasks(period_id,status,due_at);
CREATE INDEX IF NOT EXISTS ix_finance_close_actions_task ON finance_close_task_actions(task_id,created_at DESC);
COMMIT;
