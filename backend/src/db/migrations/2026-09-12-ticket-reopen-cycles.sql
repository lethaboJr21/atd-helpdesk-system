BEGIN;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reopen_count integer NOT NULL DEFAULT 0;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS latest_reopened_at timestamptz;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS latest_reopened_by_user_id bigint REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS latest_reopen_reason text;

CREATE TABLE IF NOT EXISTS ticket_resolution_cycles (
  id bigserial PRIMARY KEY,
  ticket_id bigint NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  cycle_number integer NOT NULL,
  prior_status varchar(40) NOT NULL CHECK (prior_status IN ('Resolved','Closed')),
  resolved_at timestamptz,
  closed_at timestamptz,
  reopened_at timestamptz NOT NULL DEFAULT now(),
  reopened_by_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  recurrence_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, cycle_number)
);

CREATE INDEX IF NOT EXISTS idx_ticket_resolution_cycles_ticket ON ticket_resolution_cycles(ticket_id, reopened_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_repeat_issues ON tickets(reopen_count, latest_reopened_at DESC) WHERE reopen_count > 0;

COMMIT;
