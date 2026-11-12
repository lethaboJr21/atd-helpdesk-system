BEGIN;
ALTER TABLE ticket_comments
 ADD COLUMN IF NOT EXISTS internet_message_id text,
 ADD COLUMN IF NOT EXISTS conversation_id text,
 ADD COLUMN IF NOT EXISTS received_at timestamptz,
 ADD COLUMN IF NOT EXISTS to_recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
 ADD COLUMN IF NOT EXISTS cc_recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
 ADD COLUMN IF NOT EXISTS raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS ticket_comments_conversation_idx ON ticket_comments(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ticket_comments_internet_message_idx ON ticket_comments(internet_message_id) WHERE internet_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_ticket_intake_conversation_idx ON email_ticket_intake(conversation_id) WHERE conversation_id IS NOT NULL;
COMMIT;
