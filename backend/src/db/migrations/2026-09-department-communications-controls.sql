BEGIN;
ALTER TABLE company_communication_campaigns
 ADD COLUMN IF NOT EXISTS communication_scope varchar(20) NOT NULL DEFAULT 'company' CHECK (communication_scope IN ('company','department')),
 ADD COLUMN IF NOT EXISTS publisher_department text,
 ADD COLUMN IF NOT EXISTS category varchar(60) NOT NULL DEFAULT 'general',
 ADD COLUMN IF NOT EXISTS priority varchar(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
 ADD COLUMN IF NOT EXISTS placements jsonb NOT NULL DEFAULT '["email"]'::jsonb,
 ADD COLUMN IF NOT EXISTS starts_at timestamptz, ADD COLUMN IF NOT EXISTS expires_at timestamptz,
 ADD COLUMN IF NOT EXISTS approval_status varchar(30) NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft','pending_approval','approved','rejected','published','expired','archived','cancelled')),
 ADD COLUMN IF NOT EXISTS approved_by integer REFERENCES users(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS approved_at timestamptz,
 ADD COLUMN IF NOT EXISTS requires_acknowledgement boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS published_at timestamptz, ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE TABLE IF NOT EXISTS company_communication_acknowledgements(id bigserial PRIMARY KEY,campaign_id bigint NOT NULL REFERENCES company_communication_campaigns(id) ON DELETE CASCADE,user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,acknowledged_at timestamptz NOT NULL DEFAULT NOW(),method varchar(40) NOT NULL DEFAULT 'portal',detail jsonb NOT NULL DEFAULT '{}'::jsonb,UNIQUE(campaign_id,user_id));
CREATE INDEX IF NOT EXISTS idx_company_campaign_scope_status ON company_communication_campaigns(communication_scope,approval_status,starts_at,expires_at);
CREATE INDEX IF NOT EXISTS idx_company_communication_ack_user ON company_communication_acknowledgements(user_id,acknowledged_at DESC);
COMMIT;
