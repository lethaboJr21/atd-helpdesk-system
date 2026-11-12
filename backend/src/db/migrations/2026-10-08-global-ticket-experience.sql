BEGIN;
CREATE TABLE IF NOT EXISTS agent_work_preferences(
 user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 availability_status VARCHAR(30) NOT NULL DEFAULT 'available' CHECK(availability_status IN('available','busy','leave','unavailable')),
 availability_note TEXT,available_from TIMESTAMPTZ,
 group_alert_mode VARCHAR(30) NOT NULL DEFAULT 'all_groups' CHECK(group_alert_mode IN('all_groups','default_group','selected_groups','none')),
 selected_group_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
 teams_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
 updated_by_user_id BIGINT REFERENCES users(id),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS ticket_teams_conversations(
 id BIGSERIAL PRIMARY KEY,ticket_id BIGINT NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
 status VARCHAR(30) NOT NULL DEFAULT 'contract_ready' CHECK(status IN('contract_ready','pending_authorisation','active','disabled','failed')),
 team_id TEXT,channel_id TEXT,chat_id TEXT,web_url TEXT,last_message_at TIMESTAMPTZ,
 created_by_user_id BIGINT REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS ticket_satisfaction_surveys(
 id BIGSERIAL PRIMARY KEY,ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
 requester_user_id BIGINT REFERENCES users(id),invitation_status VARCHAR(30) NOT NULL DEFAULT 'available' CHECK(invitation_status IN('available','queued','sent','completed','declined','expired')),
 rating SMALLINT CHECK(rating BETWEEN 1 AND 5),resolution_confirmed BOOLEAN,comments TEXT,
 submitted_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(ticket_id,requester_user_id));
CREATE TABLE IF NOT EXISTS ticket_change_confirmations(
 id BIGSERIAL PRIMARY KEY,ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
 history_id BIGINT REFERENCES ticket_history(id) ON DELETE SET NULL,actor_user_id BIGINT REFERENCES users(id),
 action VARCHAR(100) NOT NULL,summary TEXT NOT NULL,undo_eligible BOOLEAN NOT NULL DEFAULT FALSE,
 undo_expires_at TIMESTAMPTZ,metadata JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS ticket_survey_requester_idx ON ticket_satisfaction_surveys(requester_user_id,invitation_status);
CREATE INDEX IF NOT EXISTS ticket_change_confirmation_ticket_idx ON ticket_change_confirmations(ticket_id,created_at DESC);
COMMIT;
