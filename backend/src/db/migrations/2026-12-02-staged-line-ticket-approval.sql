CREATE TABLE IF NOT EXISTS line_ticket_staging (
  id BIGSERIAL PRIMARY KEY,
  requester_user_id BIGINT NOT NULL REFERENCES users(id),
  supervisor_user_id BIGINT NOT NULL REFERENCES users(id),
  station VARCHAR(160) NOT NULL,
  workspace VARCHAR(30) NOT NULL CHECK (workspace IN ('IT', 'PDM')),
  catalogue_item_id BIGINT NOT NULL REFERENCES workspace_catalogue_items(id),
  ticket_type VARCHAR(40) NOT NULL CHECK (ticket_type IN ('incident', 'service_request')),
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(30) NOT NULL,
  category VARCHAR(120) NOT NULL,
  sub_category VARCHAR(120) NOT NULL,
  item_category VARCHAR(120) NOT NULL,
  approval_token_hash CHAR(64),
  approval_attempts INTEGER NOT NULL DEFAULT 0 CHECK (approval_attempts >= 0),
  status VARCHAR(30) NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'delivery_failed', 'approved', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  opened_ticket_id BIGINT REFERENCES tickets(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS line_ticket_staging_requester_pending_idx
  ON line_ticket_staging(requester_user_id, created_at DESC)
  WHERE status = 'pending_approval';

CREATE UNIQUE INDEX IF NOT EXISTS line_ticket_staging_one_pending_per_requester_idx
  ON line_ticket_staging(requester_user_id)
  WHERE status = 'pending_approval';

CREATE INDEX IF NOT EXISTS line_ticket_staging_expiry_idx
  ON line_ticket_staging(expires_at)
  WHERE status = 'pending_approval';

CREATE UNIQUE INDEX IF NOT EXISTS line_ticket_staging_approval_token_idx
  ON line_ticket_staging(approval_token_hash)
  WHERE approval_token_hash IS NOT NULL;
