BEGIN;
CREATE TABLE IF NOT EXISTS finance_employee_performance_snapshots(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,period_key VARCHAR(7) NOT NULL,open_work INTEGER NOT NULL DEFAULT 0,overdue_work INTEGER NOT NULL DEFAULT 0,duty_progress NUMERIC(6,2) NOT NULL DEFAULT 0,kpi_progress NUMERIC(6,2) NOT NULL DEFAULT 0,workload_score NUMERIC(10,2) NOT NULL DEFAULT 0,captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(user_id,period_key));
CREATE TABLE IF NOT EXISTS finance_kpi_reviews(id BIGSERIAL PRIMARY KEY,kpi_id BIGINT NOT NULL,period_key VARCHAR(7) NOT NULL,review_outcome VARCHAR(30) NOT NULL DEFAULT 'pending',commentary TEXT,corrective_action TEXT,evidence_reference TEXT,reviewed_by BIGINT,reviewed_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(kpi_id,period_key));
CREATE TABLE IF NOT EXISTS finance_team_admin_actions(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,action VARCHAR(40) NOT NULL,old_value JSONB,new_value JSONB,reason TEXT,actor_user_id BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS ix_finance_performance_period ON finance_employee_performance_snapshots(period_key,workload_score DESC);
CREATE INDEX IF NOT EXISTS ix_finance_kpi_reviews_period ON finance_kpi_reviews(period_key,review_outcome);
COMMIT;
