BEGIN;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS original_due_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS effective_due_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS evidence_state VARCHAR(20) NOT NULL DEFAULT 'not_required';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS review_state VARCHAR(30);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS kpi_objective VARCHAR(60);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS kpi_period VARCHAR(20);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS confidentiality_level VARCHAR(40) DEFAULT 'Internal';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS baseline_assigned_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_by BIGINT;

ALTER TABLE finance_journals ADD COLUMN IF NOT EXISTS original_due_at TIMESTAMPTZ;
ALTER TABLE finance_journals ADD COLUMN IF NOT EXISTS effective_due_at TIMESTAMPTZ;
ALTER TABLE finance_journals ADD COLUMN IF NOT EXISTS evidence_state VARCHAR(20) NOT NULL DEFAULT 'not_required';
ALTER TABLE finance_journals ADD COLUMN IF NOT EXISTS review_state VARCHAR(30);
ALTER TABLE finance_journals ADD COLUMN IF NOT EXISTS kpi_objective VARCHAR(60);
ALTER TABLE finance_journals ADD COLUMN IF NOT EXISTS kpi_period VARCHAR(20);
ALTER TABLE finance_journals ADD COLUMN IF NOT EXISTS confidentiality_level VARCHAR(40) DEFAULT 'Internal';
ALTER TABLE finance_journals ADD COLUMN IF NOT EXISTS baseline_assigned_at TIMESTAMPTZ;
ALTER TABLE finance_journals ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE finance_journals ADD COLUMN IF NOT EXISTS closed_by BIGINT;

ALTER TABLE finance_reconciliations ADD COLUMN IF NOT EXISTS original_due_at TIMESTAMPTZ;
ALTER TABLE finance_reconciliations ADD COLUMN IF NOT EXISTS effective_due_at TIMESTAMPTZ;
ALTER TABLE finance_reconciliations ADD COLUMN IF NOT EXISTS evidence_state VARCHAR(20) NOT NULL DEFAULT 'not_required';
ALTER TABLE finance_reconciliations ADD COLUMN IF NOT EXISTS review_state VARCHAR(30);
ALTER TABLE finance_reconciliations ADD COLUMN IF NOT EXISTS kpi_objective VARCHAR(60);
ALTER TABLE finance_reconciliations ADD COLUMN IF NOT EXISTS kpi_period VARCHAR(20);
ALTER TABLE finance_reconciliations ADD COLUMN IF NOT EXISTS confidentiality_level VARCHAR(40) DEFAULT 'Internal';
ALTER TABLE finance_reconciliations ADD COLUMN IF NOT EXISTS baseline_assigned_at TIMESTAMPTZ;
ALTER TABLE finance_reconciliations ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE finance_reconciliations ADD COLUMN IF NOT EXISTS closed_by BIGINT;

ALTER TABLE finance_close_tasks ADD COLUMN IF NOT EXISTS original_due_at TIMESTAMPTZ;
ALTER TABLE finance_close_tasks ADD COLUMN IF NOT EXISTS effective_due_at TIMESTAMPTZ;
ALTER TABLE finance_close_tasks ADD COLUMN IF NOT EXISTS evidence_state VARCHAR(20) NOT NULL DEFAULT 'not_required';
ALTER TABLE finance_close_tasks ADD COLUMN IF NOT EXISTS review_state VARCHAR(30);
ALTER TABLE finance_close_tasks ADD COLUMN IF NOT EXISTS kpi_objective VARCHAR(60);
ALTER TABLE finance_close_tasks ADD COLUMN IF NOT EXISTS kpi_period VARCHAR(20);
ALTER TABLE finance_close_tasks ADD COLUMN IF NOT EXISTS confidentiality_level VARCHAR(40) DEFAULT 'Internal';
ALTER TABLE finance_close_tasks ADD COLUMN IF NOT EXISTS baseline_assigned_at TIMESTAMPTZ;
ALTER TABLE finance_close_tasks ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE finance_close_tasks ADD COLUMN IF NOT EXISTS closed_by BIGINT;

UPDATE tickets SET effective_due_at = due_at, original_due_at = due_at WHERE effective_due_at IS NULL AND due_at IS NOT NULL;
UPDATE finance_journals SET effective_due_at = due_at, original_due_at = due_at WHERE effective_due_at IS NULL AND due_at IS NOT NULL;
UPDATE finance_reconciliations SET effective_due_at = due_at, original_due_at = due_at WHERE effective_due_at IS NULL AND due_at IS NOT NULL;
UPDATE finance_close_tasks SET effective_due_at = due_at, original_due_at = due_at WHERE effective_due_at IS NULL AND due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_tickets_kpi_objective_period ON tickets(kpi_objective,kpi_period) WHERE kpi_objective IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_finance_journals_kpi ON finance_journals(kpi_objective,kpi_period) WHERE kpi_objective IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_finance_reconciliations_kpi ON finance_reconciliations(kpi_objective,kpi_period) WHERE kpi_objective IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_finance_close_tasks_kpi ON finance_close_tasks(kpi_objective,kpi_period) WHERE kpi_objective IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tickets_effective_due ON tickets(effective_due_at) WHERE effective_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_finance_journals_effective_due ON finance_journals(effective_due_at) WHERE effective_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_finance_reconciliations_effective_due ON finance_reconciliations(effective_due_at) WHERE effective_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_finance_close_tasks_effective_due ON finance_close_tasks(effective_due_at) WHERE effective_due_at IS NOT NULL;
COMMIT;