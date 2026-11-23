BEGIN;
ALTER TABLE finance_reconciliations DROP COLUMN IF EXISTS owner_user_id;
ALTER TABLE finance_email_routing_rules DROP COLUMN IF EXISTS owner_user_id;
COMMIT;