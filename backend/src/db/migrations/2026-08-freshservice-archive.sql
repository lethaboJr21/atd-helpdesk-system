BEGIN;

-- ---------------------------------------------------------------------------
-- Freshservice archive
--
-- Mirrors the Freshservice tenant into ATD Helpdesk so every historical
-- ticket, conversation, requester and asset stays queryable after the
-- Freshservice subscription lapses. Every table keeps the untouched API
-- payload in `raw` so nothing is lost to schema drift.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fs_sync_runs (
  id           SERIAL PRIMARY KEY,
  mode         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'running',
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ,
  api_calls    INTEGER NOT NULL DEFAULT 0,
  entities     JSONB NOT NULL DEFAULT '{}'::jsonb,
  error        TEXT
);

CREATE TABLE IF NOT EXISTS fs_people (
  fs_id                BIGINT PRIMARY KEY,
  kind                 TEXT NOT NULL,
  name                 TEXT,
  first_name           TEXT,
  last_name            TEXT,
  email                TEXT,
  secondary_emails     TEXT[],
  phone                TEXT,
  mobile               TEXT,
  job_title            TEXT,
  language             TEXT,
  time_zone            TEXT,
  location_fs_id       BIGINT,
  department_fs_ids    BIGINT[],
  reporting_manager_fs_id BIGINT,
  active               BOOLEAN,
  has_logged_in        BOOLEAN,
  created_at           TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ,
  raw                  JSONB NOT NULL,
  synced_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fs_people_email_idx ON fs_people (lower(email));
CREATE INDEX IF NOT EXISTS fs_people_kind_idx  ON fs_people (kind);

-- Configuration and low-volume reference objects share one table keyed by
-- `kind` so new Freshservice object types need no further migrations.
CREATE TABLE IF NOT EXISTS fs_records (
  kind         TEXT   NOT NULL,
  fs_id        BIGINT NOT NULL,
  name         TEXT,
  parent_fs_id BIGINT,
  created_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ,
  raw          JSONB NOT NULL,
  synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (kind, fs_id)
);

CREATE INDEX IF NOT EXISTS fs_records_kind_name_idx ON fs_records (kind, lower(name));

CREATE TABLE IF NOT EXISTS fs_tickets (
  fs_id                   BIGINT PRIMARY KEY,
  workspace_id            BIGINT,
  subject                 TEXT,
  description_html        TEXT,
  description_text        TEXT,
  ticket_type             TEXT,
  status_id               SMALLINT,
  status_label            TEXT,
  priority_id             SMALLINT,
  priority_label          TEXT,
  source_id               SMALLINT,
  source_label            TEXT,
  urgency                 SMALLINT,
  impact                  SMALLINT,
  category                TEXT,
  sub_category            TEXT,
  item_category           TEXT,
  requester_fs_id         BIGINT,
  requester_name          TEXT,
  requester_email         TEXT,
  requested_for_fs_id     BIGINT,
  responder_fs_id         BIGINT,
  responder_name          TEXT,
  group_fs_id             BIGINT,
  group_name              TEXT,
  department_fs_id        BIGINT,
  department_name         TEXT,
  cc_emails               TEXT[],
  to_emails               TEXT[],
  reply_cc_emails         TEXT[],
  tags                    TEXT[],
  is_escalated            BOOLEAN,
  fr_escalated            BOOLEAN,
  spam                    BOOLEAN,
  deleted                 BOOLEAN,
  due_by                  TIMESTAMPTZ,
  fr_due_by               TIMESTAMPTZ,
  first_responded_at      TIMESTAMPTZ,
  resolved_at             TIMESTAMPTZ,
  closed_at               TIMESTAMPTZ,
  created_at              TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ,
  custom_fields           JSONB,
  stats                   JSONB,
  raw                     JSONB NOT NULL,
  detail_synced_at        TIMESTAMPTZ,
  conversations_synced_at TIMESTAMPTZ,
  conversation_count      INTEGER NOT NULL DEFAULT 0,
  local_ticket_id         INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
  synced_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fs_tickets_created_idx     ON fs_tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS fs_tickets_status_idx      ON fs_tickets (status_label);
CREATE INDEX IF NOT EXISTS fs_tickets_priority_idx    ON fs_tickets (priority_label);
CREATE INDEX IF NOT EXISTS fs_tickets_requester_idx   ON fs_tickets (requester_fs_id);
CREATE INDEX IF NOT EXISTS fs_tickets_responder_idx   ON fs_tickets (responder_fs_id);
CREATE INDEX IF NOT EXISTS fs_tickets_group_idx       ON fs_tickets (group_fs_id);
CREATE INDEX IF NOT EXISTS fs_tickets_category_idx    ON fs_tickets (category);
CREATE INDEX IF NOT EXISTS fs_tickets_email_idx       ON fs_tickets (lower(requester_email));
CREATE INDEX IF NOT EXISTS fs_tickets_local_link_idx  ON fs_tickets (local_ticket_id);
CREATE INDEX IF NOT EXISTS fs_tickets_pending_convs_idx
  ON fs_tickets (fs_id) WHERE conversations_synced_at IS NULL;

CREATE INDEX IF NOT EXISTS fs_tickets_search_idx ON fs_tickets
  USING GIN (to_tsvector('english',
    coalesce(subject, '') || ' ' ||
    coalesce(description_text, '') || ' ' ||
    coalesce(requester_name, '') || ' ' ||
    coalesce(requester_email, '')));

CREATE TABLE IF NOT EXISTS fs_ticket_conversations (
  fs_id         BIGINT PRIMARY KEY,
  ticket_fs_id  BIGINT NOT NULL REFERENCES fs_tickets(fs_id) ON DELETE CASCADE,
  user_fs_id    BIGINT,
  body_html     TEXT,
  body_text     TEXT,
  incoming      BOOLEAN,
  private       BOOLEAN,
  source        SMALLINT,
  from_email    TEXT,
  to_emails     TEXT[],
  cc_emails     TEXT[],
  bcc_emails    TEXT[],
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ,
  raw           JSONB NOT NULL,
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fs_conversations_ticket_idx
  ON fs_ticket_conversations (ticket_fs_id, created_at);

CREATE INDEX IF NOT EXISTS fs_conversations_search_idx ON fs_ticket_conversations
  USING GIN (to_tsvector('english', coalesce(body_text, '')));

CREATE TABLE IF NOT EXISTS fs_attachments (
  fs_id                BIGINT PRIMARY KEY,
  ticket_fs_id         BIGINT,
  conversation_fs_id   BIGINT,
  name                 TEXT,
  content_type         TEXT,
  size_bytes           BIGINT,
  attachment_url       TEXT,
  stored_path          TEXT,
  downloaded_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ,
  raw                  JSONB NOT NULL,
  synced_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fs_attachments_ticket_idx ON fs_attachments (ticket_fs_id);
CREATE INDEX IF NOT EXISTS fs_attachments_pending_idx
  ON fs_attachments (fs_id) WHERE downloaded_at IS NULL;

CREATE TABLE IF NOT EXISTS fs_ticket_tasks (
  fs_id        BIGINT PRIMARY KEY,
  ticket_fs_id BIGINT NOT NULL REFERENCES fs_tickets(fs_id) ON DELETE CASCADE,
  title        TEXT,
  description  TEXT,
  status       SMALLINT,
  due_date     TIMESTAMPTZ,
  closed_at    TIMESTAMPTZ,
  agent_fs_id  BIGINT,
  group_fs_id  BIGINT,
  created_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ,
  raw          JSONB NOT NULL,
  synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fs_tasks_ticket_idx ON fs_ticket_tasks (ticket_fs_id);

CREATE TABLE IF NOT EXISTS fs_ticket_time_entries (
  fs_id        BIGINT PRIMARY KEY,
  ticket_fs_id BIGINT NOT NULL REFERENCES fs_tickets(fs_id) ON DELETE CASCADE,
  agent_fs_id  BIGINT,
  time_spent   TEXT,
  billable     BOOLEAN,
  note         TEXT,
  executed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ,
  raw          JSONB NOT NULL,
  synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fs_time_entries_ticket_idx ON fs_ticket_time_entries (ticket_fs_id);

CREATE TABLE IF NOT EXISTS fs_assets (
  fs_id             BIGINT PRIMARY KEY,
  display_id        BIGINT,
  name              TEXT,
  description       TEXT,
  asset_tag         TEXT,
  serial_number     TEXT,
  asset_type_fs_id  BIGINT,
  asset_type_name   TEXT,
  impact            TEXT,
  usage_type        TEXT,
  user_fs_id        BIGINT,
  location_fs_id    BIGINT,
  department_fs_id  BIGINT,
  agent_fs_id       BIGINT,
  group_fs_id       BIGINT,
  product_fs_id     BIGINT,
  vendor_fs_id      BIGINT,
  assigned_on       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ,
  type_fields       JSONB,
  raw               JSONB NOT NULL,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fs_assets_name_idx   ON fs_assets (lower(name));
CREATE INDEX IF NOT EXISTS fs_assets_serial_idx ON fs_assets (lower(serial_number));
CREATE INDEX IF NOT EXISTS fs_assets_tag_idx    ON fs_assets (lower(asset_tag));
CREATE INDEX IF NOT EXISTS fs_assets_user_idx   ON fs_assets (user_fs_id);

-- Readable ticket view with reference names resolved.
CREATE OR REPLACE VIEW v_fs_tickets AS
SELECT
  t.fs_id,
  t.subject,
  t.ticket_type,
  t.status_label,
  t.priority_label,
  t.source_label,
  t.category,
  t.sub_category,
  t.item_category,
  t.requester_name,
  t.requester_email,
  t.responder_name,
  COALESCE(t.group_name, g.name)      AS group_name,
  COALESCE(t.department_name, d.name) AS department_name,
  t.created_at,
  t.updated_at,
  t.resolved_at,
  t.closed_at,
  t.due_by,
  t.is_escalated,
  t.conversation_count,
  t.local_ticket_id
FROM fs_tickets t
LEFT JOIN fs_records g ON g.kind = 'group'      AND g.fs_id = t.group_fs_id
LEFT JOIN fs_records d ON d.kind = 'department' AND d.fs_id = t.department_fs_id
WHERE COALESCE(t.deleted, FALSE) = FALSE
  AND COALESCE(t.spam, FALSE) = FALSE;

-- Single timeline across both systems so agents can trace any ticket
-- regardless of which platform recorded it.
CREATE OR REPLACE VIEW v_ticket_trace AS
SELECT
  'helpdesk'::TEXT                     AS origin,
  t.id::TEXT                           AS record_id,
  COALESCE(t.ticket_ref, 'HD-' || t.id) AS reference,
  t.title                              AS subject,
  t.status,
  t.priority,
  NULLIF(TRIM(COALESCE(u.name, '')), '') AS requester_name,
  u.email                              AS requester_email,
  t.created_at::TIMESTAMPTZ            AS created_at,
  t.closed_at
FROM tickets t
LEFT JOIN users u ON u.id = t.requester_id
UNION ALL
SELECT
  'freshservice'::TEXT     AS origin,
  f.fs_id::TEXT            AS record_id,
  'FS-' || f.fs_id         AS reference,
  f.subject,
  f.status_label           AS status,
  f.priority_label         AS priority,
  f.requester_name,
  f.requester_email,
  f.created_at,
  f.closed_at
FROM fs_tickets f;

COMMIT;
