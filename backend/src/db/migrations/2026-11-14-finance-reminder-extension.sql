BEGIN;
ALTER TABLE finance_task_reminders ADD COLUMN IF NOT EXISTS assignment_cycle INTEGER NOT NULL DEFAULT 1;
ALTER TABLE finance_task_reminders ADD COLUMN IF NOT EXISTS work_item_type VARCHAR(20) DEFAULT 'ticket';
CREATE TABLE IF NOT EXISTS finance_reminder_thresholds(
 id BIGSERIAL PRIMARY KEY,
 finance_function VARCHAR(60),
 reminder_type VARCHAR(30) NOT NULL CHECK(reminder_type IN('half_elapsed','due_24h','overdue','review_overdue','returned','extension_decision','final_approval')),
 threshold_value NUMERIC(10,2),
 threshold_unit VARCHAR(10) DEFAULT 'percent' CHECK(threshold_unit IN('percent','hours','days')),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

UPDATE finance_task_reminders SET assignment_cycle = 1 WHERE assignment_cycle IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_finance_task_reminders_idempotency
 ON finance_task_reminders(ticket_id,user_id,reminder_type,assignment_cycle);

CREATE INDEX IF NOT EXISTS ix_finance_task_reminders_type_enabled ON finance_task_reminders(reminder_type,enabled,last_sent_at);
CREATE INDEX IF NOT EXISTS ix_finance_reminder_thresholds_function_type ON finance_reminder_thresholds(finance_function,reminder_type,active);
COMMIT;