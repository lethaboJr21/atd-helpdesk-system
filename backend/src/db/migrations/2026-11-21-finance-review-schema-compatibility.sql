BEGIN;

ALTER TABLE finance_journals
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

ALTER TABLE finance_task_reviews
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

UPDATE finance_task_reviews
SET reviewed_at = COALESCE(acknowledged_at, updated_at, submitted_at)
WHERE reviewed_at IS NULL
  AND review_status IN ('accepted', 'rejected');

COMMIT;
