BEGIN;

ALTER TABLE company_communication_deliveries
  DROP CONSTRAINT IF EXISTS company_communication_deliveries_status_check;
ALTER TABLE company_communication_deliveries
  ADD CONSTRAINT company_communication_deliveries_status_check
  CHECK (status IN ('pending','processing','sent','skipped','failed'));

ALTER TABLE company_communication_deliveries
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS effective_email text,
  ADD COLUMN IF NOT EXISTS governance_mode varchar(20),
  ADD COLUMN IF NOT EXISTS environment_redirected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE INDEX IF NOT EXISTS idx_company_delivery_claim
  ON company_communication_deliveries(campaign_id,status,processing_started_at,id);

COMMIT;
