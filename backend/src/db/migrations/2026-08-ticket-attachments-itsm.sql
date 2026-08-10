BEGIN;

-- First-class ITSM fields for native portal tickets.
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS impact TEXT,
  ADD COLUMN IF NOT EXISTS urgency TEXT,
  ADD COLUMN IF NOT EXISTS item_category TEXT,
  ADD COLUMN IF NOT EXISTS request_details JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS tickets_impact_idx ON tickets (impact);
CREATE INDEX IF NOT EXISTS tickets_urgency_idx ON tickets (urgency);
CREATE INDEX IF NOT EXISTS tickets_request_details_gin
  ON tickets USING GIN (request_details);

-- Native ticket attachments (separate from Freshservice archive copies).
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id              BIGSERIAL PRIMARY KEY,
  ticket_id       INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  uploaded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  original_name   TEXT NOT NULL,
  stored_name     TEXT NOT NULL,
  stored_path     TEXT NOT NULL,
  content_type    TEXT,
  size_bytes      BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticket_attachments_ticket_idx
  ON ticket_attachments (ticket_id, created_at DESC);

COMMIT;
