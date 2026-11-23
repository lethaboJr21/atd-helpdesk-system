BEGIN;

CREATE TABLE IF NOT EXISTS finance_scoring_parameter_overrides(
 id BIGSERIAL PRIMARY KEY,
 finance_function VARCHAR(80) NOT NULL UNIQUE,
 late_submission_penalty_pct INTEGER CHECK(late_submission_penalty_pct BETWEEN 0 AND 100),
 cross_department_add_back_pct INTEGER CHECK(cross_department_add_back_pct BETWEEN 0 AND 100),
 updated_by BIGINT REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ,
 CHECK(late_submission_penalty_pct IS NOT NULL OR cross_department_add_back_pct IS NOT NULL));

CREATE TABLE IF NOT EXISTS finance_manager_quality_allocations(
 id BIGSERIAL PRIMARY KEY,
 work_item_id BIGINT NOT NULL,
 work_item_type VARCHAR(20) NOT NULL CHECK(work_item_type IN('ticket','journal','reconciliation','month_end')),
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 justification TEXT,
 rater_user_id BIGINT NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(work_item_id,work_item_type));

CREATE TABLE IF NOT EXISTS finance_manager_quality_allocation_audit(
 id BIGSERIAL PRIMARY KEY,
 work_item_id BIGINT NOT NULL,
 work_item_type VARCHAR(20) NOT NULL,
 previous_rating INTEGER,
 new_rating INTEGER NOT NULL,
 previous_rater_user_id BIGINT,
 new_rater_user_id BIGINT NOT NULL,
 reason TEXT,
 actor_user_id BIGINT NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS finance_function_reviewer_mappings(
 id BIGSERIAL PRIMARY KEY,
 finance_function VARCHAR(80) NOT NULL,
 person_key VARCHAR(60) NOT NULL,
 person_variants TEXT[] NOT NULL,
 email_hint TEXT,
 reviewer_user_id BIGINT REFERENCES users(id),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_by BIGINT REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ);

CREATE TABLE IF NOT EXISTS finance_final_approvers(
 id BIGSERIAL PRIMARY KEY,
 scope_key VARCHAR(20) NOT NULL CHECK(scope_key IN('all_finance','ap_office','cfo')),
 person_key VARCHAR(60) NOT NULL,
 person_variants TEXT[] NOT NULL,
 email_hint TEXT,
 approver_user_id BIGINT REFERENCES users(id),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_by BIGINT REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ);

ALTER TABLE finance_kpi_definitions ADD COLUMN IF NOT EXISTS measurement_cadence VARCHAR(10) NOT NULL DEFAULT 'monthly' CHECK(measurement_cadence IN('monthly','quarterly','biannual','annual'));
ALTER TABLE finance_journal_workflow_levels ADD COLUMN IF NOT EXISTS review_sla_hours INTEGER CHECK(review_sla_hours IS NULL OR review_sla_hours > 0);
ALTER TABLE finance_kpi_score_audit ADD COLUMN IF NOT EXISTS previous_reviewer_timeliness NUMERIC(5,2);
ALTER TABLE finance_kpi_score_audit ADD COLUMN IF NOT EXISTS new_reviewer_timeliness NUMERIC(5,2);

DO $$
DECLARE
  has_duplicates BOOLEAN;
  constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM finance_kpi_item_scores
    GROUP BY work_item_id, work_item_type, period_key
    HAVING COUNT(*) > 1
  ) INTO has_duplicates;
  IF has_duplicates THEN
    DELETE FROM finance_kpi_item_scores a
    USING finance_kpi_item_scores b
    WHERE a.work_item_id = b.work_item_id
      AND a.work_item_type = b.work_item_type
      AND a.period_key = b.period_key
      AND (a.calculated_at < b.calculated_at OR (a.calculated_at = b.calculated_at AND a.id < b.id));
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'finance_kpi_item_scores_work_item_id_work_item_type_period_key_key'
  ) INTO constraint_exists;
  IF NOT constraint_exists THEN
    ALTER TABLE finance_kpi_item_scores
      ADD CONSTRAINT finance_kpi_item_scores_work_item_id_work_item_type_period_key_key
      UNIQUE (work_item_id, work_item_type, period_key);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ix_ffrm_active ON finance_function_reviewer_mappings(finance_function) WHERE active;
CREATE UNIQUE INDEX IF NOT EXISTS ix_ffa_active ON finance_final_approvers(scope_key) WHERE active;
CREATE INDEX IF NOT EXISTS ix_mqa_work ON finance_manager_quality_allocations(work_item_id,work_item_type);
CREATE INDEX IF NOT EXISTS ix_mqa_rater ON finance_manager_quality_allocations(rater_user_id);
CREATE INDEX IF NOT EXISTS ix_mqa_audit_work ON finance_manager_quality_allocation_audit(work_item_id,work_item_type,created_at DESC);
CREATE INDEX IF NOT EXISTS ix_fspo_function ON finance_scoring_parameter_overrides(finance_function);
CREATE INDEX IF NOT EXISTS ix_kpi_item_scores_reviewer_period ON finance_kpi_item_scores(reviewer_user_id,period_key);
CREATE INDEX IF NOT EXISTS ix_journals_kpi_period_submitted ON finance_journals(kpi_period,submitted_at);
CREATE INDEX IF NOT EXISTS ix_reconciliations_kpi_period_submitted ON finance_reconciliations(kpi_period,COALESCE(reviewed_at,approved_at,closed_at));
CREATE INDEX IF NOT EXISTS ix_close_tasks_kpi_period_completed ON finance_close_tasks(kpi_period,completed_at);
CREATE INDEX IF NOT EXISTS ix_ffrm_user ON finance_function_reviewer_mappings(reviewer_user_id);

INSERT INTO finance_function_reviewer_mappings(finance_function,person_key,person_variants,email_hint,active) VALUES
 ('Accounts Payable','suphaporn',ARRAY['suphaporn'],NULL,TRUE),
 ('Accounts Receivable','sbongileJele',ARRAY['sibongile jele','sbongile jele'],NULL,TRUE),
 ('Cost Accounting','mncedisiValenshiya',ARRAY['mncedisi valenshiya'],NULL,TRUE),
 ('Asset Control','mncedisiValenshiya',ARRAY['mncedisi valenshiya'],NULL,TRUE),
 ('External / Third-Party Loans','luthoMafunda',ARRAY['lutho mafunda'],NULL,TRUE),
 ('Related Party Loans','ayandaMbatha',ARRAY['ayanda mbatha'],NULL,TRUE),
 ('Tax and Compliance','sbongileJele',ARRAY['sibongile jele','sbongile jele'],NULL,TRUE),
 ('Treasury','suphaporn',ARRAY['suphaporn'],NULL,TRUE),
 ('Payroll','willawan',ARRAY['willawan'],NULL,TRUE),
 ('Other Balance Sheet Accounts','luthoMafunda',ARRAY['lutho mafunda'],NULL,TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO finance_final_approvers(scope_key,person_key,person_variants,email_hint,active) VALUES
 ('all_finance','bongani',ARRAY['bongani'],NULL,TRUE),
 ('ap_office','suphaporn',ARRAY['suphaporn'],NULL,TRUE),
 ('cfo','therapha',ARRAY['therapha'],NULL,TRUE)
ON CONFLICT DO NOTHING;

COMMIT;