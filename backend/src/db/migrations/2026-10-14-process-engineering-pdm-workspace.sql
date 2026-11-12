BEGIN;
INSERT INTO service_workspaces(code,name,workspace_type,description,status,settings)
VALUES('PDM','Process Engineering (PDM)','department','Process engineering, tooling, manufacturing applications and production-quality support.','draft','{"department":"Process Engineering","workspaceKey":"pdm"}'::jsonb)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,settings=service_workspaces.settings||EXCLUDED.settings,updated_at=NOW();
CREATE TABLE IF NOT EXISTS pdm_catalogue_items(
 id BIGSERIAL PRIMARY KEY,category VARCHAR(120) NOT NULL,sub_category VARCHAR(160) NOT NULL,item VARCHAR(180) NOT NULL,
 description TEXT,icon_key VARCHAR(80),colour_key VARCHAR(40),default_priority VARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK(default_priority IN('Low','Medium','High','Critical')),
 priority_locked BOOLEAN NOT NULL DEFAULT TRUE,summary_locked BOOLEAN NOT NULL DEFAULT TRUE,sla_policy_key VARCHAR(120),default_group_id BIGINT REFERENCES support_groups(id),
 visibility JSONB NOT NULL DEFAULT '{"operations":true,"employee":true,"plant":true,"pdm":true}'::jsonb,required_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
 applicability JSONB NOT NULL DEFAULT '{}'::jsonb,is_other BOOLEAN NOT NULL DEFAULT FALSE,is_active BOOLEAN NOT NULL DEFAULT TRUE,display_order INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(category,sub_category,item));
CREATE TABLE IF NOT EXISTS pdm_ticket_context(
 ticket_id BIGINT PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,catalogue_item_id BIGINT REFERENCES pdm_catalogue_items(id),plant TEXT,line TEXT,station TEXT,machine TEXT,
 product_family TEXT,part_number TEXT,process_name TEXT,quality_reference TEXT,engineering_owner_user_id BIGINT REFERENCES users(id),
 risk_level VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK(risk_level IN('normal','elevated','high','critical')),manager_instruction TEXT,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO pdm_catalogue_items(category,sub_category,item,default_priority,is_other,display_order) VALUES
('Application','Qmuzik','Line status','High',FALSE,10),('Application','Qmuzik','Cannot process','High',FALSE,20),
('Application','MES','Cannot log in','Medium',FALSE,30),('Application','MES','Cannot print','Medium',FALSE,40),
('Application','PLC-RSB assembly','Other','Medium',TRUE,50),('Application','PLC-SRS','Line status','High',FALSE,60),('Application','PLC-SRS','Cannot process','High',FALSE,70),
('Tooling','Checking Fixtures','Other','Medium',TRUE,80),('Tooling','Jigs','Tooling damaged','High',FALSE,90),('Tooling','Jigs','Part not to specification','High',FALSE,100),
('RSB','Part defect','Part defect','High',FALSE,110),('Thermoforming','Other','Other','Medium',TRUE,120),('Blowmoulding','Other','Other','Medium',TRUE,130)
ON CONFLICT(category,sub_category,item) DO NOTHING;
CREATE INDEX IF NOT EXISTS pdm_catalogue_active_idx ON pdm_catalogue_items(is_active,category,sub_category,display_order);
CREATE INDEX IF NOT EXISTS pdm_ticket_context_operational_idx ON pdm_ticket_context(plant,line,station,machine,product_family);
COMMIT;
