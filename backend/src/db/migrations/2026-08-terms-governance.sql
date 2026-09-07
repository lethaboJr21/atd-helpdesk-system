BEGIN;
CREATE TABLE IF NOT EXISTS legal_documents (
  id bigserial PRIMARY KEY,
  document_key varchar(80) NOT NULL,
  version varchar(40) NOT NULL,
  title varchar(200) NOT NULL,
  summary text,
  content_html text NOT NULL,
  content_hash varchar(64) NOT NULL,
  published_at timestamptz,
  retired_at timestamptz,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (document_key, version)
);
CREATE TABLE IF NOT EXISTS legal_document_acceptances (
  id bigserial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  legal_document_id bigint NOT NULL REFERENCES legal_documents(id) ON DELETE RESTRICT,
  accepted_at timestamptz NOT NULL DEFAULT NOW(),
  ip_address inet,
  user_agent text,
  acceptance_source varchar(40) NOT NULL DEFAULT 'portal',
  UNIQUE (user_id, legal_document_id)
);
CREATE INDEX IF NOT EXISTS legal_documents_current_idx
  ON legal_documents(document_key, published_at DESC)
  WHERE published_at IS NOT NULL AND retired_at IS NULL;
CREATE INDEX IF NOT EXISTS legal_acceptances_user_idx
  ON legal_document_acceptances(user_id, accepted_at DESC);
INSERT INTO system_settings(setting_key, setting_value, description)
VALUES ('terms.enforcement_mode', '"preview"'::jsonb,
        'Terms enforcement mode: disabled, preview or enforced.')
ON CONFLICT (setting_key) DO NOTHING;
COMMIT;
