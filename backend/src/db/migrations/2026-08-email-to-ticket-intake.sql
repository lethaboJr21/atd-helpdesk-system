BEGIN;

CREATE TABLE IF NOT EXISTS email_ticket_intake (
  id                  BIGSERIAL PRIMARY KEY,
  provider            TEXT NOT NULL DEFAULT 'microsoft-graph',
  mailbox             TEXT NOT NULL,
  graph_message_id    TEXT NOT NULL,
  internet_message_id TEXT,
  conversation_id     TEXT,
  sender_email        TEXT,
  sender_name         TEXT,
  subject             TEXT,
  received_at         TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'processing',
  classification      TEXT,
  confidence          NUMERIC(5,4),
  assigned_group_id   INTEGER REFERENCES support_groups(id) ON DELETE SET NULL,
  ticket_id           INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
  error_message       TEXT,
  raw_metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mailbox, graph_message_id)
);

CREATE INDEX IF NOT EXISTS email_ticket_intake_status_idx
  ON email_ticket_intake (status, received_at DESC);
CREATE INDEX IF NOT EXISTS email_ticket_intake_ticket_idx
  ON email_ticket_intake (ticket_id);
CREATE INDEX IF NOT EXISTS email_ticket_intake_internet_message_idx
  ON email_ticket_intake (internet_message_id)
  WHERE internet_message_id IS NOT NULL;

COMMIT;