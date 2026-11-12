BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_catalogue_single_other ON workspace_catalogue_items(workspace_id,catalogue_type) WHERE is_other=TRUE AND archived_at IS NULL;
INSERT INTO workspace_catalogue_items(workspace_id,catalogue_type,category,item_name,user_description,default_priority,priority_locked,summary_locked,visibility,display_order,is_other,is_active,created_at,updated_at)
SELECT w.id,t.kind,'Other','Other',CASE WHEN t.kind='incident' THEN 'Report an incident that is not listed in this workspace catalogue.' ELSE 'Request a service that is not listed in this workspace catalogue.' END,'Medium',FALSE,FALSE,'{"employee":true,"operations":true,"plant":false,"workspace":true}'::jsonb,9999,TRUE,TRUE,NOW(),NOW()
FROM service_workspaces w CROSS JOIN (VALUES('incident'::varchar),('service_request'::varchar))t(kind)
WHERE NOT EXISTS(SELECT 1 FROM workspace_catalogue_items i WHERE i.workspace_id=w.id AND i.catalogue_type=t.kind AND i.is_other=TRUE AND i.archived_at IS NULL);
COMMIT;
