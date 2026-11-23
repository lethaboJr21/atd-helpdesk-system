BEGIN;
-- Align with repository definition: 2026-10-26-finance-journals-reconciliations.sql:17
ALTER TABLE finance_reconciliations ADD COLUMN IF NOT EXISTS owner_user_id BIGINT;
-- Repository-approved backfill (DDR-4): create route writes owner_user_id = created_by (routes/financeWorkspace.js:176)
UPDATE finance_reconciliations SET owner_user_id = created_by WHERE owner_user_id IS NULL;
ALTER TABLE finance_reconciliations ALTER COLUMN owner_user_id SET NOT NULL;
-- Align with repository definition: 2026-10-26-finance-email-intake-routing-governance.sql:9 (nullable — no backfill)
ALTER TABLE finance_email_routing_rules ADD COLUMN IF NOT EXISTS owner_user_id BIGINT;
COMMIT;