BEGIN;
ALTER TABLE support_group_members ADD COLUMN IF NOT EXISTS is_default_assignment BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS support_group_member_one_default_per_user_idx ON support_group_members(user_id) WHERE is_default_assignment=TRUE;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_important BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS importance_source VARCHAR(40);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS important_marked_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS important_marked_by_user_id BIGINT REFERENCES users(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS catalogue_item_id TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS catalogue_item_name TEXT;
CREATE INDEX IF NOT EXISTS tickets_important_active_idx ON tickets(is_important,created_at DESC) WHERE is_important=TRUE;
CREATE TABLE IF NOT EXISTS ticket_escalations(
 id BIGSERIAL PRIMARY KEY,ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
 initiated_by_user_id BIGINT NOT NULL REFERENCES users(id),target_user_id BIGINT NOT NULL REFERENCES users(id),
 target_level VARCHAR(40) NOT NULL CHECK(target_level IN('reporting_manager','support_group_manager','department_hod','approved_senior')),
 reason TEXT NOT NULL,requested_action TEXT,source VARCHAR(40) NOT NULL DEFAULT 'helpdesk',
 status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK(status IN('pending','acknowledged','resolved','cancelled')),
 acknowledged_at TIMESTAMPTZ,acknowledged_by_user_id BIGINT REFERENCES users(id),resolved_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS ticket_escalations_ticket_idx ON ticket_escalations(ticket_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ticket_escalations_target_idx ON ticket_escalations(target_user_id,status,created_at DESC);
COMMIT;
