BEGIN;

DROP TABLE IF EXISTS finance_final_approvers CASCADE;
DROP TABLE IF EXISTS finance_function_reviewer_mappings CASCADE;
DROP TABLE IF EXISTS finance_manager_quality_allocation_audit CASCADE;
DROP TABLE IF EXISTS finance_manager_quality_allocations CASCADE;
DROP TABLE IF EXISTS finance_scoring_parameter_overrides CASCADE;

ALTER TABLE finance_kpi_score_audit DROP COLUMN IF EXISTS new_reviewer_timeliness;
ALTER TABLE finance_kpi_score_audit DROP COLUMN IF EXISTS previous_reviewer_timeliness;
ALTER TABLE finance_journal_workflow_levels DROP COLUMN IF EXISTS review_sla_hours;
ALTER TABLE finance_kpi_definitions DROP COLUMN IF EXISTS measurement_cadence;

COMMIT;