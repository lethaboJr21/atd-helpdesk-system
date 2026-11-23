BEGIN;

ALTER TABLE hr_service_requests
  DROP CONSTRAINT IF EXISTS hr_service_requests_request_type_check;

ALTER TABLE hr_service_requests
  ADD CONSTRAINT hr_service_requests_request_type_check
  CHECK (request_type IN (
    'ad_account',
    'm365_account',
    'device_assignment',
    'employee_onboarding',
    'offboarding',
    'other'
  ));

ALTER TABLE hr_service_requests
  ADD COLUMN IF NOT EXISTS employee_microsoft_id VARCHAR(128);
ALTER TABLE hr_service_requests
  ADD COLUMN IF NOT EXISTS is_new_hire BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS hr_onboarding_fulfillment (
  request_id BIGINT PRIMARY KEY REFERENCES hr_service_requests(id) ON DELETE CASCADE,
  ad_username VARCHAR(254),
  ad_email VARCHAR(254),
  ad_account_completed_at TIMESTAMPTZ,
  ad_account_completed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  m365_request_sent_at TIMESTAMPTZ,
  m365_request_sent_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  m365_email VARCHAR(254),
  m365_sso_completed_at TIMESTAMPTZ,
  m365_sso_completed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ams_asset_id VARCHAR(128),
  ams_asset_name VARCHAR(200),
  ams_asset_tag VARCHAR(120),
  ams_serial_number VARCHAR(160),
  asset_allocated_at TIMESTAMPTZ,
  asset_allocated_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  issuance_signature_name VARCHAR(160),
  issuance_signature_data_url TEXT,
  issuance_signed_at TIMESTAMPTZ,
  issuance_signed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_onboarding_fulfillment_updated
  ON hr_onboarding_fulfillment(updated_at DESC);

COMMIT;
