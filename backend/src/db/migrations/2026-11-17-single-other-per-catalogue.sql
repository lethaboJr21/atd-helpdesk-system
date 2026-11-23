BEGIN;
-- One canonical Other per workspace catalogue type. Existing branch-specific Others are archived.
WITH ranked AS (
 SELECT id,workspace_id,catalogue_type,
   ROW_NUMBER() OVER(PARTITION BY workspace_id,catalogue_type ORDER BY CASE WHEN category='Other' AND sub_category IS NULL THEN 0 ELSE 1 END,id) rn
 FROM workspace_catalogue_items
 WHERE archived_at IS NULL AND (is_other=TRUE OR LOWER(TRIM(item_name))='other')
), canonical AS (
 SELECT * FROM ranked WHERE rn=1
)
UPDATE workspace_catalogue_items i
SET category='Other',sub_category=NULL,item_name='Other',is_other=TRUE,is_active=TRUE,archived_at=NULL,display_order=999,updated_at=NOW()
FROM canonical c WHERE i.id=c.id;
WITH ranked AS (
 SELECT id,ROW_NUMBER() OVER(PARTITION BY workspace_id,catalogue_type ORDER BY CASE WHEN category='Other' AND sub_category IS NULL THEN 0 ELSE 1 END,id) rn
 FROM workspace_catalogue_items WHERE archived_at IS NULL AND (is_other=TRUE OR LOWER(TRIM(item_name))='other')
)
UPDATE workspace_catalogue_items i SET is_active=FALSE,archived_at=COALESCE(archived_at,NOW()),updated_at=NOW()
FROM ranked r WHERE i.id=r.id AND r.rn>1;
-- Add a canonical Other for any catalogue type that has no current Other.
WITH cats AS (
 SELECT DISTINCT workspace_id,catalogue_type FROM workspace_catalogue_items WHERE archived_at IS NULL AND is_active=TRUE
), missing AS (
 SELECT c.* FROM cats c WHERE NOT EXISTS(SELECT 1 FROM workspace_catalogue_items i WHERE i.workspace_id=c.workspace_id AND i.catalogue_type=c.catalogue_type AND i.is_other=TRUE AND i.archived_at IS NULL)
)
INSERT INTO workspace_catalogue_items(workspace_id,catalogue_type,category,sub_category,item_name,default_priority,priority_locked,summary_locked,is_other,is_active,display_order,visibility,required_fields,optional_fields)
SELECT workspace_id,catalogue_type,'Other',NULL,'Other','Medium',FALSE,FALSE,TRUE,TRUE,999,'{"employee":true,"operations":true,"plant":true,"workspace":true}'::jsonb,'[]'::jsonb,'[]'::jsonb FROM missing;
DROP INDEX IF EXISTS workspace_catalogue_one_other_per_branch_idx;
CREATE UNIQUE INDEX IF NOT EXISTS workspace_catalogue_one_other_per_catalogue_idx ON workspace_catalogue_items(workspace_id,catalogue_type) WHERE is_other=TRUE AND archived_at IS NULL;
COMMIT;