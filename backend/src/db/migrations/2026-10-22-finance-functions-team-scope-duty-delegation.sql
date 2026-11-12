BEGIN;
CREATE TABLE IF NOT EXISTS finance_functions (
 id BIGSERIAL PRIMARY KEY, code VARCHAR(50) NOT NULL UNIQUE, name VARCHAR(160) NOT NULL UNIQUE,
 description TEXT, office_code VARCHAR(80), manager_user_id BIGINT REFERENCES users(id), primary_backup_user_id BIGINT REFERENCES users(id),
 assignment_enabled BOOLEAN NOT NULL DEFAULT TRUE, active BOOLEAN NOT NULL DEFAULT TRUE,
 retired_at TIMESTAMPTZ, retired_by BIGINT REFERENCES users(id), retirement_reason TEXT,
 created_by BIGINT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS finance_employee_function_memberships (
 id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id),finance_function_id BIGINT NOT NULL REFERENCES finance_functions(id),
 membership_type VARCHAR(30) NOT NULL DEFAULT 'additional',assignment_eligible BOOLEAN NOT NULL DEFAULT TRUE,
 primary_backup_user_id BIGINT REFERENCES users(id),secondary_backup_user_id BIGINT REFERENCES users(id),
 effective_from DATE,effective_to DATE,active BOOLEAN NOT NULL DEFAULT TRUE,created_by BIGINT REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(user_id,finance_function_id)
);
CREATE TABLE IF NOT EXISTS finance_employee_scope_events (
 id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id),work_status VARCHAR(40) NOT NULL,
 reason_code VARCHAR(60) NOT NULL,reason_details TEXT,effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),expected_return_at TIMESTAMPTZ,
 permanent BOOLEAN NOT NULL DEFAULT FALSE,replacement_user_id BIGINT REFERENCES users(id),replacement_function_id BIGINT REFERENCES finance_functions(id),
 reassign_existing BOOLEAN NOT NULL DEFAULT FALSE,redirect_new BOOLEAN NOT NULL DEFAULT TRUE,recorded_by BIGINT NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),ended_at TIMESTAMPTZ,ended_by BIGINT REFERENCES users(id),end_reason TEXT
);
CREATE TABLE IF NOT EXISTS finance_duty_delegations (
 id BIGSERIAL PRIMARY KEY,source_user_id BIGINT REFERENCES users(id),source_function_id BIGINT REFERENCES finance_functions(id),
 target_user_id BIGINT REFERENCES users(id),target_function_id BIGINT REFERENCES finance_functions(id),target_team_queue BOOLEAN NOT NULL DEFAULT FALSE,
 scope_type VARCHAR(40) NOT NULL,scope_payload JSONB NOT NULL DEFAULT '{}'::jsonb,reason TEXT NOT NULL,effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),effective_to TIMESTAMPTZ,
 redirect_new BOOLEAN NOT NULL DEFAULT TRUE,reassign_existing BOOLEAN NOT NULL DEFAULT FALSE,status VARCHAR(30) NOT NULL DEFAULT 'active',
 created_by BIGINT NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),ended_at TIMESTAMPTZ,ended_by BIGINT REFERENCES users(id),end_reason TEXT
);
CREATE TABLE IF NOT EXISTS finance_locations (
 id BIGSERIAL PRIMARY KEY,code VARCHAR(60) NOT NULL UNIQUE,name VARCHAR(160) NOT NULL,location_type VARCHAR(30) NOT NULL CHECK(location_type IN('office','meeting_room','temporary_work_area')),
 active BOOLEAN NOT NULL DEFAULT TRUE,capacity INTEGER,external_auditor_use BOOLEAN NOT NULL DEFAULT FALSE,finance_host_required BOOLEAN NOT NULL DEFAULT FALSE,visitor_approval_required BOOLEAN NOT NULL DEFAULT FALSE,
 created_by BIGINT REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO finance_locations(code,name,location_type,external_auditor_use,finance_host_required,visitor_approval_required)
VALUES('FIN_BOARDROOM','Finance Boardroom','meeting_room',TRUE,TRUE,TRUE)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,location_type='meeting_room',external_auditor_use=TRUE,finance_host_required=TRUE,visitor_approval_required=TRUE;
CREATE INDEX IF NOT EXISTS idx_finance_scope_events_user_active ON finance_employee_scope_events(user_id,ended_at,effective_from);
CREATE INDEX IF NOT EXISTS idx_finance_duty_delegations_active ON finance_duty_delegations(status,effective_from,effective_to);
COMMIT;
