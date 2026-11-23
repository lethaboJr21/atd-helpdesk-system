BEGIN;

DROP TABLE IF EXISTS finance_scheduled_reports;
DROP TABLE IF EXISTS finance_distribution_lists;
DROP TABLE IF EXISTS finance_it_service_surveys;
DROP TABLE IF EXISTS finance_time_tracking_entries;
DROP TABLE IF EXISTS finance_task_progress_updates;
DROP TABLE IF EXISTS finance_feedback_entries;
DROP TABLE IF EXISTS finance_email_delivery_log;
DROP TABLE IF EXISTS finance_email_opt_outs;
DROP TABLE IF EXISTS finance_email_allocation_rules;
DROP TABLE IF EXISTS finance_journal_workflow_audits;
DROP TABLE IF EXISTS finance_journal_workflow_levels;
DROP TABLE IF EXISTS finance_journal_workflow_chains;
DROP TABLE IF EXISTS finance_delegated_authority;
DROP TABLE IF EXISTS finance_corrective_action_plans;
DROP TABLE IF EXISTS finance_kpi_definitions;
DROP TABLE IF EXISTS finance_grading_band_configs;

ALTER TABLE tickets DROP COLUMN IF EXISTS progress_percentage;
ALTER TABLE tickets DROP COLUMN IF EXISTS partially_complete;
ALTER TABLE tickets DROP COLUMN IF EXISTS last_progress_update_at;
ALTER TABLE finance_journals DROP COLUMN IF EXISTS progress_percentage;
ALTER TABLE finance_journals DROP COLUMN IF EXISTS partially_complete;
ALTER TABLE finance_journals DROP COLUMN IF EXISTS last_progress_update_at;
ALTER TABLE finance_reconciliations DROP COLUMN IF EXISTS progress_percentage;
ALTER TABLE finance_reconciliations DROP COLUMN IF EXISTS partially_complete;
ALTER TABLE finance_reconciliations DROP COLUMN IF EXISTS last_progress_update_at;
ALTER TABLE finance_close_tasks DROP COLUMN IF EXISTS progress_percentage;
ALTER TABLE finance_close_tasks DROP COLUMN IF EXISTS partially_complete;
ALTER TABLE finance_close_tasks DROP COLUMN IF EXISTS last_progress_update_at;

COMMIT;