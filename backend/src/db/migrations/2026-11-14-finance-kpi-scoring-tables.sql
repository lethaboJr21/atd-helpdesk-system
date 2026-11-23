BEGIN;
CREATE TABLE IF NOT EXISTS finance_kpi_objectives(
 id BIGSERIAL PRIMARY KEY,
 name VARCHAR(60) NOT NULL UNIQUE,
 weight NUMERIC(5,2) NOT NULL CHECK(weight BETWEEN 0 AND 100),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 description TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS finance_kpi_item_scores(
 id BIGSERIAL PRIMARY KEY,
 work_item_id BIGINT NOT NULL,
 work_item_type VARCHAR(20) NOT NULL CHECK(work_item_type IN('ticket','journal','reconciliation','month_end')),
 timeliness_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK(timeliness_score BETWEEN 0 AND 100),
 quality_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK(quality_score BETWEEN 0 AND 100),
 item_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK(item_score BETWEEN 0 AND 100),
 reviewer_user_id BIGINT,
 reviewer_timeliness_score NUMERIC(5,2) CHECK(reviewer_timeliness_score BETWEEN 0 AND 100),
 period_key VARCHAR(20) NOT NULL,
 objective_name VARCHAR(60),
 calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS finance_kpi_objective_aggregates(
 id BIGSERIAL PRIMARY KEY,
 objective_name VARCHAR(60) NOT NULL,
 weight NUMERIC(5,2) NOT NULL,
 period_score NUMERIC(5,2) NOT NULL DEFAULT 0,
 employee_user_id BIGINT NOT NULL,
 period_key VARCHAR(20) NOT NULL,
 calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(objective_name,employee_user_id,period_key));

CREATE TABLE IF NOT EXISTS finance_kpi_periods(
 id BIGSERIAL PRIMARY KEY,
 period_type VARCHAR(20) NOT NULL CHECK(period_type IN('Monthly','Quarterly','Biannual','Annual','Custom')),
 period_key VARCHAR(20) NOT NULL UNIQUE,
 period_start DATE NOT NULL,
 period_end DATE NOT NULL,
 label TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(period_end>=period_start));

CREATE TABLE IF NOT EXISTS finance_kpi_score_audit(
 id BIGSERIAL PRIMARY KEY,
 work_item_id BIGINT NOT NULL,
 work_item_type VARCHAR(20) NOT NULL,
 previous_timeliness NUMERIC(5,2),
 previous_quality NUMERIC(5,2),
 previous_item_score NUMERIC(5,2),
 new_timeliness NUMERIC(5,2),
 new_quality NUMERIC(5,2),
 new_item_score NUMERIC(5,2),
 reason TEXT,
 actor_user_id BIGINT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

INSERT INTO finance_kpi_objectives(name,weight,active,description) VALUES
 ('Month-End Close',30.00,TRUE,'Month-end financial close process completion and timeliness'),
 ('Reconciliation Control',25.00,TRUE,'Account reconciliation accuracy and completion'),
 ('Cut-off Accuracy',15.00,TRUE,'Period cut-off transaction accuracy'),
 ('Financial Reporting Quality',20.00,TRUE,'Quality and timeliness of financial reports'),
 ('Internal Finance Service Delivery',10.00,TRUE,'Internal finance service delivery and support')
 ON CONFLICT(name) DO NOTHING;

CREATE INDEX IF NOT EXISTS ix_finance_kpi_item_scores_work ON finance_kpi_item_scores(work_item_id,work_item_type,period_key);
CREATE INDEX IF NOT EXISTS ix_finance_kpi_item_scores_reviewer ON finance_kpi_item_scores(reviewer_user_id,period_key) WHERE reviewer_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_finance_kpi_objective_aggregates_emp ON finance_kpi_objective_aggregates(employee_user_id,period_key);
CREATE INDEX IF NOT EXISTS ix_finance_kpi_score_audit_work ON finance_kpi_score_audit(work_item_id,work_item_type,created_at DESC);
COMMIT;