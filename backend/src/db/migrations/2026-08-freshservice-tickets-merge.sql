BEGIN;

-- ---------------------------------------------------------------------------
-- Promote the Freshservice mirror into first-class helpdesk tickets.
--
-- Imported tickets live in `tickets` alongside natively raised ones rather than
-- in a separate archive. A handful of nullable columns carry the detail the
-- Freshservice records need: requester and group attribution for people and
-- teams that have no ATD Helpdesk record, plus the category and SLA fields the
-- dashboard already expects.
-- ---------------------------------------------------------------------------

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'helpdesk',
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS sub_category TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS ticket_type TEXT,
  ADD COLUMN IF NOT EXISTS sla_pct SMALLINT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS external_requester_name TEXT,
  ADD COLUMN IF NOT EXISTS external_requester_email TEXT,
  ADD COLUMN IF NOT EXISTS external_assignee_name TEXT,
  ADD COLUMN IF NOT EXISTS external_group_name TEXT;

CREATE INDEX IF NOT EXISTS tickets_origin_idx   ON tickets (origin);
CREATE INDEX IF NOT EXISTS tickets_category_idx ON tickets (category);
CREATE INDEX IF NOT EXISTS tickets_external_requester_email_idx
  ON tickets (lower(external_requester_email));

-- Ordering helper: active work must sort ahead of resolved and closed history
-- now that two years of closed tickets share the table.
CREATE INDEX IF NOT EXISTS tickets_active_created_idx
  ON tickets (created_at DESC)
  WHERE status NOT IN ('Resolved', 'Closed');

-- Imported replies need a stable key so re-running the sync cannot duplicate
-- them, and an author fallback for agents who never had a local account.
ALTER TABLE ticket_comments
  ADD COLUMN IF NOT EXISTS external_id  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS author_name  TEXT,
  ADD COLUMN IF NOT EXISTS author_email TEXT,
  ADD COLUMN IF NOT EXISTS origin       TEXT NOT NULL DEFAULT 'helpdesk';

CREATE UNIQUE INDEX IF NOT EXISTS ticket_comments_external_id_idx
  ON ticket_comments (external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ticket_comments_ticket_idx
  ON ticket_comments (ticket_id, created_at);

COMMIT;
