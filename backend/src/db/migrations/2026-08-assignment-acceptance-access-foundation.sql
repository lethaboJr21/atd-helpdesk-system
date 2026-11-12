BEGIN;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS action_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS action_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS ticket_assignment_proposals (
  id bigserial PRIMARY KEY,
  ticket_id integer NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  owning_group_id integer NOT NULL REFERENCES support_groups(id) ON DELETE RESTRICT,
  proposed_assignee_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  proposed_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  assignment_controller_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  previous_proposal_id bigint REFERENCES ticket_assignment_proposals(id) ON DELETE SET NULL,
  status varchar(30) NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('group_queue','proposed','accepted','redirected','declined','withdrawn','expired','returned_to_queue')),
  proposal_reason text,
  response_note text,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_proposals_ticket_created
  ON ticket_assignment_proposals(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_proposals_assignee_status
  ON ticket_assignment_proposals(proposed_assignee_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_proposals_group_status
  ON ticket_assignment_proposals(owning_group_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignment_proposals_one_active
  ON ticket_assignment_proposals(ticket_id)
  WHERE status IN ('group_queue','proposed','accepted');

CREATE TABLE IF NOT EXISTS ticket_collaborators (
  ticket_id integer NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collaborator_role varchar(30) NOT NULL DEFAULT 'collaborator'
    CHECK (collaborator_role IN ('collaborator','observer','specialist','approver')),
  added_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  added_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  PRIMARY KEY(ticket_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_ticket_collaborators_user_active
  ON ticket_collaborators(user_id,is_active,ticket_id);

CREATE TABLE IF NOT EXISTS ticket_email_participants (
  id bigserial PRIMARY KEY,
  ticket_id integer NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  email varchar(320) NOT NULL,
  display_name varchar(200),
  participant_type varchar(30) NOT NULL DEFAULT 'cc'
    CHECK (participant_type IN ('to','cc','observer','escalation')),
  added_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  added_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_email_participant_unique_active
  ON ticket_email_participants(ticket_id,lower(email),participant_type)
  WHERE is_active=true;
CREATE INDEX IF NOT EXISTS idx_ticket_email_participants_ticket
  ON ticket_email_participants(ticket_id,is_active);

CREATE TABLE IF NOT EXISTS access_requests (
  id bigserial PRIMARY KEY,
  requester_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key varchar(120) NOT NULL,
  requested_enabled boolean NOT NULL DEFAULT true,
  access_duration varchar(20) NOT NULL DEFAULT 'permanent'
    CHECK (access_duration IN ('temporary','permanent')),
  requested_start_at timestamptz,
  requested_expires_at timestamptz,
  business_reason text NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled','expired','revoked')),
  approver_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (access_duration='permanent' OR requested_expires_at IS NOT NULL),
  CHECK (requested_expires_at IS NULL OR requested_start_at IS NULL OR requested_expires_at>requested_start_at)
);
CREATE INDEX IF NOT EXISTS idx_access_requests_requester_created
  ON access_requests(requester_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_requests_approver_pending
  ON access_requests(approver_user_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_requests_target_feature
  ON access_requests(target_user_id,feature_key,status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_access_requests_one_pending
  ON access_requests(target_user_id,feature_key)
  WHERE status='pending';

CREATE TABLE IF NOT EXISTS temporary_feature_entitlements (
  id bigserial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key varchar(120) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  access_request_id bigint REFERENCES access_requests(id) ON DELETE SET NULL,
  granted_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  approved_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  revocation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at>starts_at)
);
CREATE INDEX IF NOT EXISTS idx_temporary_entitlements_effective
  ON temporary_feature_entitlements(user_id,feature_key,starts_at,expires_at)
  WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_temporary_entitlements_one_active
  ON temporary_feature_entitlements(user_id,feature_key)
  WHERE revoked_at IS NULL;

INSERT INTO system_settings(setting_key,setting_value,description)
VALUES
 ('assignment_acceptance.mode','"preview"'::jsonb,
  'Assignment acceptance workflow mode: disabled, preview or enforced.'),
 ('assignment_acceptance.default_timeout_hours','24'::jsonb,
  'Default time allowed for a proposed assignee to respond.'),
 ('access_requests.mode','"preview"'::jsonb,
  'Access request workflow mode: disabled, preview or enforced.'),
 ('temporary_entitlements.mode','"preview"'::jsonb,
  'Temporary feature entitlement mode: disabled, preview or enforced.')
ON CONFLICT(setting_key) DO NOTHING;

COMMIT;
