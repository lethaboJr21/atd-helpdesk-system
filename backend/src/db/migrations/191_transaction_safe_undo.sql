BEGIN;
CREATE TABLE IF NOT EXISTS ticket_activity_undo (
 id bigserial PRIMARY KEY,
 ticket_id integer NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
 history_id integer NOT NULL REFERENCES ticket_history(id) ON DELETE CASCADE,
 requested_by_user_id integer NOT NULL REFERENCES users(id),
 action varchar(100) NOT NULL,
 expected_value text NOT NULL,
 restore_value text,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 consumed_by_user_id integer REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT NOW(),
 CONSTRAINT ticket_activity_undo_history_unique UNIQUE(history_id)
);
CREATE INDEX IF NOT EXISTS idx_ticket_activity_undo_ticket ON ticket_activity_undo(ticket_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_activity_undo_expiry ON ticket_activity_undo(expires_at) WHERE consumed_at IS NULL;
COMMIT;
