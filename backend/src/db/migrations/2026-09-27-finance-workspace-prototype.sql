BEGIN;
CREATE TABLE IF NOT EXISTS finance_offices (
  id BIGSERIAL PRIMARY KEY, code VARCHAR(40) UNIQUE NOT NULL, name VARCHAR(160) NOT NULL,
  office_kind VARCHAR(80) NOT NULL, manager_user_id BIGINT REFERENCES users(id), is_default_assignee BOOLEAN NOT NULL DEFAULT FALSE,
  entra_reference JSONB NOT NULL DEFAULT '{}'::jsonb, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS finance_product_families (
  id BIGSERIAL PRIMARY KEY, code VARCHAR(20) UNIQUE NOT NULL, name VARCHAR(160) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS finance_process_catalog (
  id BIGSERIAL PRIMARY KEY, code VARCHAR(80) UNIQUE NOT NULL, name VARCHAR(160) NOT NULL,
  office_code VARCHAR(40), confidentiality_default VARCHAR(80) NOT NULL DEFAULT 'Finance Restricted',
  approval_required BOOLEAN NOT NULL DEFAULT FALSE, active BOOLEAN NOT NULL DEFAULT TRUE,
  form_schema JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS finance_export_audit (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id), export_type VARCHAR(80) NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb, columns_exported JSONB NOT NULL DEFAULT '[]'::jsonb,
  record_count INTEGER NOT NULL DEFAULT 0, confidentiality_level VARCHAR(80) NOT NULL,
  reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO finance_offices(code,name,office_kind,is_default_assignee) VALUES
 ('MAIN_CFO','Finance Main and CFO Office','operational_and_executive',FALSE),
 ('AP','Accounts Payable Office','operational',FALSE),
 ('BOARDROOM','Finance Boardroom','governed_meeting_and_decision_space',FALSE)
ON CONFLICT (code) DO NOTHING;
INSERT INTO finance_product_families(code,name) VALUES
 ('RSB','Rear Step Bumpers'),('CF','Chassis Frames'),('TG','Tailgates'),('BL','Bedliners'),('BR','Box Rails'),('EC','Endcaps'),('OTHER','Other or uncategorised products')
ON CONFLICT (code) DO NOTHING;
COMMIT;
