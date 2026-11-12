BEGIN;
CREATE TABLE IF NOT EXISTS ticket_participants (
 id bigserial PRIMARY KEY,
 ticket_id integer NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
 user_id integer REFERENCES users(id) ON DELETE CASCADE,
 external_email varchar(320),
 display_name varchar(200),
 source_type varchar(40) NOT NULL CHECK(source_type IN ('forwarded_owner','department_participant','mentioned','cc','requested_reply','collaborator','observer','approver','specialist','external_email_participant')),
 access_scope varchar(30) NOT NULL DEFAULT 'reply_only' CHECK(access_scope IN ('read_only','reply_only')),
 invitation_reason text NOT NULL,
 invited_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
 invitation_status varchar(30) NOT NULL DEFAULT 'active' CHECK(invitation_status IN ('active','accepted','expired','revoked')),
 email_status varchar(30) NOT NULL DEFAULT 'pending' CHECK(email_status IN ('pending','sent','skipped','failed')),
 email_detail text,
 invited_at timestamptz NOT NULL DEFAULT now(), viewed_at timestamptz, accepted_at timestamptz, last_participated_at timestamptz,
 expires_at timestamptz, revoked_at timestamptz, revoked_by_user_id integer REFERENCES users(id) ON DELETE SET NULL, revocation_reason text,
 is_active boolean NOT NULL DEFAULT true,
 CHECK(user_id IS NOT NULL OR external_email IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_participants_user_active ON ticket_participants(ticket_id,user_id) WHERE is_active=true AND user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_participants_email_active ON ticket_participants(ticket_id,lower(external_email)) WHERE is_active=true AND external_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_participants_user_scope ON ticket_participants(user_id,is_active,ticket_id);
CREATE TABLE IF NOT EXISTS ticket_forwarding_events (
 id bigserial PRIMARY KEY, ticket_id integer NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
 forwarded_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
 destination_type varchar(30) NOT NULL CHECK(destination_type IN ('employee','department','external_email')),
 destination_user_id integer REFERENCES users(id) ON DELETE SET NULL, destination_department varchar(200), destination_email varchar(320),
 forwarding_reason text NOT NULL, participant_id bigint REFERENCES ticket_participants(id) ON DELETE SET NULL,
 access_status varchar(30) NOT NULL DEFAULT 'pending', email_status varchar(30) NOT NULL DEFAULT 'pending', email_detail text,
 forwarded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_forwarding_ticket ON ticket_forwarding_events(ticket_id,forwarded_at DESC);
COMMIT;
