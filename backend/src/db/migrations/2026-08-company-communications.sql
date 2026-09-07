BEGIN;

CREATE TABLE IF NOT EXISTS company_communication_campaigns (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text NOT NULL,
  audience_type varchar(40) NOT NULL DEFAULT 'all'
    CHECK (audience_type IN ('all', 'departments', 'users')),
  audience_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(40) NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'scheduled',
      'sending',
      'sent',
      'partially_sent',
      'skipped',
      'cancelled',
      'failed'
    )),
  scheduled_at timestamptz,
  idempotency_key varchar(200) NOT NULL UNIQUE,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  sent_at timestamptz,
  cancelled_at timestamptz,
  last_error text,
  CONSTRAINT scheduled_campaign_requires_date CHECK (
    status <> 'scheduled' OR scheduled_at IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS company_communication_deliveries (
  id bigserial PRIMARY KEY,
  campaign_id bigint NOT NULL
    REFERENCES company_communication_campaigns(id) ON DELETE CASCADE,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  intended_email text NOT NULL,
  status varchar(40) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
  provider varchar(80),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, intended_email)
);

CREATE INDEX IF NOT EXISTS idx_company_campaign_due
  ON company_communication_campaigns(status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_company_campaign_created
  ON company_communication_campaigns(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_company_delivery_campaign
  ON company_communication_deliveries(campaign_id, status);

COMMIT;
