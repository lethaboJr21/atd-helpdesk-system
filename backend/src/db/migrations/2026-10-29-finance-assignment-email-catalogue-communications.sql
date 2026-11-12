BEGIN;
CREATE TABLE IF NOT EXISTS finance_sender_automation_rules(
 id BIGSERIAL PRIMARY KEY,mailbox_address TEXT,sender_email TEXT NOT NULL,display_name TEXT,subject_pattern TEXT,body_pattern TEXT,
 auto_create_ticket BOOLEAN NOT NULL DEFAULT TRUE,finance_function TEXT,default_owner_user_id BIGINT,default_priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
 evidence_required BOOLEAN NOT NULL DEFAULT FALSE,notify_management_on_completion BOOLEAN NOT NULL DEFAULT TRUE,active BOOLEAN NOT NULL DEFAULT TRUE,
 created_by BIGINT NOT NULL,updated_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(mailbox_address,sender_email,subject_pattern));
CREATE TABLE IF NOT EXISTS finance_task_completion_events(
 id BIGSERIAL PRIMARY KEY,ticket_id BIGINT NOT NULL,user_id BIGINT,finance_function TEXT,completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 evidence_reference TEXT,evidence_verified BOOLEAN NOT NULL DEFAULT FALSE,management_notified_at TIMESTAMPTZ,notification_status VARCHAR(25) NOT NULL DEFAULT 'pending',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS company_communication_interactions(
 id BIGSERIAL PRIMARY KEY,campaign_id BIGINT NOT NULL,delivery_id BIGINT,user_id BIGINT,external_email TEXT,interaction_type VARCHAR(40) NOT NULL,
 interaction_detail JSONB NOT NULL DEFAULT '{}'::jsonb,occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS ix_finance_sender_rules_sender ON finance_sender_automation_rules(LOWER(sender_email),active);
CREATE INDEX IF NOT EXISTS ix_finance_completion_ticket ON finance_task_completion_events(ticket_id,completed_at DESC);
CREATE INDEX IF NOT EXISTS ix_company_comm_interactions_campaign ON company_communication_interactions(campaign_id,occurred_at DESC);
INSERT INTO finance_employee_responsibilities(user_id,office_code,finance_function,availability_status,delegation_eligible,is_finance_manager,active,created_by)
SELECT u.id,'MAIN_CFO','General Finance Administration','available',TRUE,
       (LOWER(COALESCE(u.job_title,'')) LIKE '%finance manager%' OR LOWER(COALESCE(u.job_title,'')) LIKE '%chief financial officer%'),TRUE,
       COALESCE((SELECT id FROM users WHERE role='superadmin' ORDER BY id LIMIT 1),u.id)
FROM users u
WHERE u.archived_at IS NULL AND u.status='active' AND COALESCE(u.account_type,'person')='person' AND LOWER(COALESCE(u.department,''))='finance'
  AND NOT EXISTS(SELECT 1 FROM finance_employee_responsibilities fr WHERE fr.user_id=u.id);
INSERT INTO workspace_catalogue_items(workspace_id,catalogue_type,category,sub_category,item_name,user_description,internal_guidance,default_priority,required_fields,optional_fields,visibility,display_order,is_other,is_active,created_by,updated_by)
SELECT w.id,t.catalogue_type,'Other',NULL,'Other','Use this option when no listed catalogue item applies.','Preserve the selected workspace and request type, then route as a manual untemplated request.','Medium','[]'::jsonb,'[]'::jsonb,'{"plant":false,"employee":true,"workspace":true,"operations":true}'::jsonb,9999,TRUE,TRUE,
       COALESCE((SELECT id FROM users WHERE role='superadmin' ORDER BY id LIMIT 1),1),COALESCE((SELECT id FROM users WHERE role='superadmin' ORDER BY id LIMIT 1),1)
FROM service_workspaces w CROSS JOIN (VALUES('incident'),('service_request')) t(catalogue_type)
WHERE LOWER(COALESCE(w.status,'draft')) NOT IN ('archived','disabled','inactive') AND NOT EXISTS(SELECT 1 FROM workspace_catalogue_items i WHERE i.workspace_id=w.id AND i.catalogue_type=t.catalogue_type AND i.is_other=TRUE AND i.is_active=TRUE);
COMMIT;
