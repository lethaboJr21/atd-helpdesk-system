BEGIN;

ALTER TABLE email_ticket_intake
  ADD COLUMN IF NOT EXISTS acknowledgement_status TEXT,
  ADD COLUMN IF NOT EXISTS acknowledgement_error TEXT,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS email_ticket_intake_ack_status_idx
  ON email_ticket_intake (acknowledgement_status, updated_at DESC);

COMMIT;