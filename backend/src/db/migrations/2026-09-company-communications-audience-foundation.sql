BEGIN;

ALTER TABLE company_communication_campaigns
    ADD COLUMN IF NOT EXISTS audience_definition jsonb
    NOT NULL DEFAULT '{"type":"all","include":{"wholeCompany":true},"exclude":{},"externalEmails":[]}'::jsonb;

ALTER TABLE company_communication_campaigns
    DROP CONSTRAINT IF EXISTS company_communication_campaigns_audience_type_check;

ALTER TABLE company_communication_campaigns
    ADD CONSTRAINT company_communication_campaigns_audience_type_check
    CHECK (audience_type IN ('all', 'departments', 'users', 'combined'));

CREATE INDEX IF NOT EXISTS idx_company_communication_campaigns_audience_definition
    ON company_communication_campaigns USING gin (audience_definition);

COMMIT;
