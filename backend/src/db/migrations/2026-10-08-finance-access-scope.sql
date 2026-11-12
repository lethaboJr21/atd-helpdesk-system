BEGIN;

CREATE TABLE IF NOT EXISTS finance_approved_positions (
  id BIGSERIAL PRIMARY KEY,
  position_key VARCHAR(160) UNIQUE NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  access_level VARCHAR(30) NOT NULL CHECK (access_level IN ('employee','manager','workspace_manager','security_admin','auditor','boardroom')),
  allowed_offices JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_functions JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_confidentiality VARCHAR(80) NOT NULL DEFAULT 'Internal',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO finance_approved_positions(position_key,display_name,access_level,max_confidentiality) VALUES
 ('accountant','Accountant','employee','Finance Restricted'),
 ('accountant assistant','Accountant Assistant','employee','Finance Restricted'),
 ('office manager','Office Manager','manager','Confidential'),
 ('accountant manager','Accountant Manager','manager','Confidential'),
 ('finance manager','Finance Manager','workspace_manager','CFO Restricted')
ON CONFLICT(position_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS finance_access_overrides (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  access_level VARCHAR(30) NOT NULL CHECK (access_level IN ('employee','manager','workspace_manager','security_admin','auditor','boardroom')),
  allowed_offices JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_functions JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_confidentiality VARCHAR(80) NOT NULL DEFAULT 'Internal',
  reason TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  granted_by BIGINT NOT NULL REFERENCES users(id),
  revoked_at TIMESTAMPTZ,
  revoked_by BIGINT REFERENCES users(id),
  revocation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at > starts_at)
);
CREATE INDEX IF NOT EXISTS finance_access_overrides_effective_idx ON finance_access_overrides(user_id,starts_at,expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS finance_access_decisions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  endpoint TEXT NOT NULL,
  method VARCHAR(12) NOT NULL,
  decision VARCHAR(20) NOT NULL CHECK (decision IN ('allowed','denied')),
  source VARCHAR(30) NOT NULL,
  access_level VARCHAR(30),
  department TEXT,
  job_title TEXT,
  office_code VARCHAR(40),
  finance_function VARCHAR(80),
  reporting_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason_code VARCHAR(80) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS finance_access_decisions_user_date_idx ON finance_access_decisions(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS finance_access_decisions_decision_date_idx ON finance_access_decisions(decision,created_at DESC);

ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS confidentiality_level VARCHAR(80) NOT NULL DEFAULT 'Internal';
ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS office_code VARCHAR(40) REFERENCES finance_offices(code);
ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS restricted_fields JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE finance_ticket_operations ADD COLUMN IF NOT EXISTS access_reviewed_at TIMESTAMPTZ;

COMMIT;
