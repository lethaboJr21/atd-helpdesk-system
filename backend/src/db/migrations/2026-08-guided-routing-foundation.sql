BEGIN;

CREATE TABLE IF NOT EXISTS request_routing_rules (
  id bigserial PRIMARY KEY,
  rule_key varchar(100) NOT NULL UNIQUE,
  request_type varchar(40) NOT NULL,
  service_area varchar(100) NOT NULL,
  category varchar(150),
  sub_category varchar(150),
  item_category varchar(150),
  workspace varchar(120),
  target_group_id integer REFERENCES support_groups(id) ON DELETE SET NULL,
  allow_queue_submission boolean NOT NULL DEFAULT true,
  require_individual_assignee boolean NOT NULL DEFAULT false,
  automatic_assignment_enabled boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  routing_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_request_routing_rules_lookup
  ON request_routing_rules(request_type, service_area, is_active, priority DESC);

INSERT INTO system_settings(setting_key, setting_value, description)
VALUES
  ('request_routing.mode', '"preview"'::jsonb,
   'Guided request routing mode: disabled, preview or enforced.'),
  ('request_routing.default_triage_group_id', 'null'::jsonb,
   'Default support group used for blank and unmatched requests.')
ON CONFLICT(setting_key) DO NOTHING;

COMMIT;