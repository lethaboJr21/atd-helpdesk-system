BEGIN;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS archived_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS archive_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_tickets_active_queue ON tickets(archived_at, status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_archived_at ON tickets(archived_at DESC) WHERE archived_at IS NOT NULL;
COMMIT;
