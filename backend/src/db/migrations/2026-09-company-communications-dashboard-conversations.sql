BEGIN;
ALTER TABLE company_communication_campaigns ADD COLUMN IF NOT EXISTS allow_comments boolean NOT NULL DEFAULT false;
ALTER TABLE company_communication_campaigns ADD COLUMN IF NOT EXISTS published_at timestamptz;
CREATE TABLE IF NOT EXISTS company_communication_reads (
 campaign_id bigint NOT NULL REFERENCES company_communication_campaigns(id) ON DELETE CASCADE,
 user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 read_at timestamptz NOT NULL DEFAULT NOW(),
 PRIMARY KEY(campaign_id,user_id)
);
CREATE TABLE IF NOT EXISTS company_communication_comments (
 id bigserial PRIMARY KEY,
 campaign_id bigint NOT NULL REFERENCES company_communication_campaigns(id) ON DELETE CASCADE,
 author_user_id integer REFERENCES users(id) ON DELETE SET NULL,
 body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
 is_hidden boolean NOT NULL DEFAULT false,
 hidden_by integer REFERENCES users(id) ON DELETE SET NULL,
 hidden_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT NOW(),
 updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_company_communication_comments_campaign ON company_communication_comments(campaign_id,created_at,id);
COMMIT;
