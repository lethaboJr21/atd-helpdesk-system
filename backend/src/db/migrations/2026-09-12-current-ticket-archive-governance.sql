BEGIN;
CREATE TABLE IF NOT EXISTS ticket_deletion_tombstones (
  id bigserial PRIMARY KEY,
  ticket_id bigint NOT NULL,
  ticket_ref varchar(100) NOT NULL,
  title text,
  requester_id bigint,
  deleted_by_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  deletion_reason text NOT NULL,
  ticket_snapshot jsonb NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_deletion_tombstones_ref
  ON ticket_deletion_tombstones(ticket_ref, deleted_at DESC);
COMMIT;
