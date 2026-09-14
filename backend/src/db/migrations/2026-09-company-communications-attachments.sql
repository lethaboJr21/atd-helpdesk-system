BEGIN;
CREATE TABLE IF NOT EXISTS company_communication_attachments (
 id bigserial PRIMARY KEY,
 campaign_id bigint NOT NULL REFERENCES company_communication_campaigns(id) ON DELETE CASCADE,
 original_name text NOT NULL,
 stored_name text NOT NULL UNIQUE,
 stored_path text NOT NULL,
 content_type text NOT NULL,
 size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
 sha256 varchar(64) NOT NULL,
 uploaded_by integer REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_company_communication_attachments_campaign ON company_communication_attachments(campaign_id, created_at, id);
COMMIT;
