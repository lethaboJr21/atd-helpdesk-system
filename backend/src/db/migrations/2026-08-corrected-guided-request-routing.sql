BEGIN;

CREATE TABLE IF NOT EXISTS request_routing_rules (
  id bigserial PRIMARY KEY,
  rule_key varchar(120) NOT NULL UNIQUE,
  request_type varchar(40) NOT NULL,
  service_area varchar(100) NOT NULL,
  category varchar(150),
  sub_category varchar(150),
  item_category varchar(150),
  workspace varchar(120) NOT NULL DEFAULT 'IT',
  target_group_id integer NOT NULL REFERENCES support_groups(id) ON DELETE RESTRICT,
  allow_queue_submission boolean NOT NULL DEFAULT true,
  require_individual_assignee boolean NOT NULL DEFAULT false,
  automatic_assignment_enabled boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  routing_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_request_routing_rules_lookup
  ON request_routing_rules(request_type,service_area,is_active,priority DESC);

INSERT INTO system_settings(setting_key,setting_value,description)
VALUES
 ('request_routing.mode','"preview"'::jsonb,'Guided request routing mode: disabled, preview or enforced.'),
 ('request_routing.default_triage_group_id','2'::jsonb,'Default support group for blank and unmatched IT requests.')
ON CONFLICT(setting_key) DO UPDATE SET
 setting_value=EXCLUDED.setting_value,
 description=EXCLUDED.description,
 updated_at=NOW();

UPDATE support_groups SET is_default_triage=FALSE WHERE id<>2 AND is_default_triage=TRUE;
UPDATE support_groups SET is_default_triage=TRUE,updated_at=NOW() WHERE id=2;

DELETE FROM request_routing_rules
WHERE rule_key IN (
 'incident.syspro','incident.infrastructure','incident.infrastructure.hardware',
 'incident.infrastructure.software','incident.infrastructure.network_wifi',
 'incident.infrastructure.laptop_desktop','incident.infrastructure.printer_scanner',
 'incident.infrastructure.application_installation','incident.infrastructure.access',
 'incident.infrastructure.other','incident.qmuzik','incident.plc_refresh','incident.blank'
);

INSERT INTO request_routing_rules
(rule_key,request_type,service_area,category,sub_category,item_category,workspace,target_group_id,allow_queue_submission,require_individual_assignee,automatic_assignment_enabled,is_active,priority,routing_metadata)
VALUES
 ('incident.syspro','incident','syspro_erp','Application Software','Syspro',NULL,'IT',1,TRUE,FALSE,FALSE,TRUE,200,'{"label":"Syspro / ERP","selectorOrder":1}'::jsonb),
 ('incident.infrastructure','incident','infrastructure','Infrastructure',NULL,NULL,'IT',2,TRUE,FALSE,FALSE,TRUE,190,'{"label":"Infrastructure","selectorOrder":2,"hasChildren":true}'::jsonb),
 ('incident.infrastructure.hardware','incident','infrastructure','Hardware /Equipment','Hardware',NULL,'IT',2,TRUE,FALSE,FALSE,TRUE,180,'{"label":"Hardware","parent":"incident.infrastructure"}'::jsonb),
 ('incident.infrastructure.software','incident','infrastructure','Software','Software Issue',NULL,'IT',2,TRUE,FALSE,FALSE,TRUE,180,'{"label":"Software","parent":"incident.infrastructure"}'::jsonb),
 ('incident.infrastructure.network_wifi','incident','infrastructure','Network','Wi-Fi',NULL,'IT',2,TRUE,FALSE,FALSE,TRUE,180,'{"label":"Network / Wi-Fi","parent":"incident.infrastructure"}'::jsonb),
 ('incident.infrastructure.laptop_desktop','incident','infrastructure','Hardware /Equipment','Laptop / Computer',NULL,'IT',2,TRUE,FALSE,FALSE,TRUE,180,'{"label":"Laptop or Desktop","parent":"incident.infrastructure"}'::jsonb),
 ('incident.infrastructure.printer_scanner','incident','infrastructure','Hardware /Equipment','Office Printers',NULL,'IT',2,TRUE,FALSE,FALSE,TRUE,180,'{"label":"Printer or Scanner","parent":"incident.infrastructure"}'::jsonb),
 ('incident.infrastructure.application_installation','incident','infrastructure','Application Software','Application Installation',NULL,'IT',2,TRUE,FALSE,FALSE,TRUE,180,'{"label":"Application Installation","parent":"incident.infrastructure"}'::jsonb),
 ('incident.infrastructure.access','incident','infrastructure','Access / Security','User Account or Access',NULL,'IT',2,TRUE,FALSE,FALSE,TRUE,180,'{"label":"User Account or Access","parent":"incident.infrastructure"}'::jsonb),
 ('incident.infrastructure.other','incident','infrastructure','Infrastructure','Other Infrastructure',NULL,'IT',2,TRUE,FALSE,FALSE,TRUE,170,'{"label":"Other Infrastructure","parent":"incident.infrastructure"}'::jsonb),
 ('incident.qmuzik','incident','qmuzik','Application Software','QMuzik',NULL,'IT',2,TRUE,FALSE,FALSE,TRUE,200,'{"label":"QMuzik","selectorOrder":3}'::jsonb),
 ('incident.plc_refresh','incident','plc_ot','Operational Technology','PLC Refresh',NULL,'IT',2,TRUE,FALSE,FALSE,TRUE,200,'{"label":"PLC / Operational Technology","selectorOrder":4,"itDirected":true}'::jsonb),
 ('incident.blank','incident','blank',NULL,NULL,NULL,'IT',2,TRUE,FALSE,FALSE,TRUE,10,'{"label":"Start with a blank incident","selectorOrder":5,"fallback":true}'::jsonb);

COMMIT;
