BEGIN;

CREATE TABLE IF NOT EXISTS hr_service_requests (
  id BIGSERIAL PRIMARY KEY,
  requester_user_id BIGINT NOT NULL REFERENCES users(id),
  request_type VARCHAR(32) NOT NULL
    CHECK (request_type IN ('ad_account', 'm365_account', 'device_assignment', 'offboarding', 'other')),
  employee_name VARCHAR(160) NOT NULL,
  employee_email VARCHAR(254),
  department VARCHAR(120) NOT NULL,
  job_title VARCHAR(120),
  start_date DATE,
  effective_date DATE,
  device_type VARCHAR(120),
  details TEXT NOT NULL DEFAULT '',
  status VARCHAR(24) NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'approved', 'rejected', 'handed_off')),
  approval_note TEXT,
  reviewed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  it_ticket_id BIGINT UNIQUE REFERENCES tickets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_service_requests_status_created
  ON hr_service_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_service_requests_requester
  ON hr_service_requests (requester_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS hr_service_request_events (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES hr_service_requests(id) ON DELETE CASCADE,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(32) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_service_request_events_request
  ON hr_service_request_events (request_id, created_at DESC);

COMMIT;
