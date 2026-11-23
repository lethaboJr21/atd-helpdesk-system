BEGIN;

WITH pdm AS (
  SELECT id FROM service_workspaces WHERE code='PDM'
),
desired(category,sub_category,item_name,default_priority,display_order) AS (
  VALUES
    ('Application','MES','Cannot log in','Medium',10),
    ('Application','MES','Cannot print','Medium',20),
    ('Application','MES','Other','Medium',30),
    ('Application','Machines and the PLCs / PLC-RSB assembly','Other','Medium',40),
    ('Application','Machines and the PLCs / PLC-SRS - Finished RSB Electronic Storage with Robot lift','Line status','High',50),
    ('Application','Machines and the PLCs / PLC-SRS - Finished RSB Electronic Storage with Robot lift','Cannot process','High',60),
    ('Application','Machines and the PLCs / PLC-SRS - Finished RSB Electronic Storage with Robot lift','Other','Medium',70),
    ('Application','Qmuzik App on the line','Line status','High',80),
    ('Application','Qmuzik App on the line','Cannot process','High',90),
    ('Application','Qmuzik App on the line','Other','Medium',100),
    ('Blowmoulding station issues','General','Other','Medium',110),
    ('Other','General','Other','Medium',120),
    ('RSB','Part defect','Part defect','High',130),
    ('RSB','Part defect','Other','Medium',140),
    ('Thermoforming issues','General','Other','Medium',150),
    ('Tooling','Checking Fixtures','Other','Medium',160),
    ('Tooling','Jigs tools','Tooling damaged','High',170),
    ('Tooling','Jigs tools','Part not to specification','High',180),
    ('Tooling','Jigs tools','Other','Medium',190)
)
UPDATE workspace_catalogue_items
SET is_active=FALSE,
    archived_at=COALESCE(archived_at,NOW()),
    updated_at=NOW()
WHERE workspace_id=(SELECT id FROM pdm)
  AND catalogue_type='incident'
  AND archived_at IS NULL;

WITH pdm AS (
  SELECT id FROM service_workspaces WHERE code='PDM'
),
desired(category,sub_category,item_name,default_priority,display_order) AS (
  VALUES
    ('Application','MES','Cannot log in','Medium',10),
    ('Application','MES','Cannot print','Medium',20),
    ('Application','MES','Other','Medium',30),
    ('Application','Machines and the PLCs / PLC-RSB assembly','Other','Medium',40),
    ('Application','Machines and the PLCs / PLC-SRS - Finished RSB Electronic Storage with Robot lift','Line status','High',50),
    ('Application','Machines and the PLCs / PLC-SRS - Finished RSB Electronic Storage with Robot lift','Cannot process','High',60),
    ('Application','Machines and the PLCs / PLC-SRS - Finished RSB Electronic Storage with Robot lift','Other','Medium',70),
    ('Application','Qmuzik App on the line','Line status','High',80),
    ('Application','Qmuzik App on the line','Cannot process','High',90),
    ('Application','Qmuzik App on the line','Other','Medium',100),
    ('Blowmoulding station issues','General','Other','Medium',110),
    ('Other','General','Other','Medium',120),
    ('RSB','Part defect','Part defect','High',130),
    ('RSB','Part defect','Other','Medium',140),
    ('Thermoforming issues','General','Other','Medium',150),
    ('Tooling','Checking Fixtures','Other','Medium',160),
    ('Tooling','Jigs tools','Tooling damaged','High',170),
    ('Tooling','Jigs tools','Part not to specification','High',180),
    ('Tooling','Jigs tools','Other','Medium',190)
)
INSERT INTO workspace_catalogue_items(
  workspace_id,catalogue_type,category,sub_category,item_name,
  default_priority,priority_locked,summary_locked,is_other,is_active,
  archived_at,display_order,visibility
)
SELECT pdm.id,'incident',desired.category,desired.sub_category,desired.item_name,
       desired.default_priority,TRUE,FALSE,FALSE,TRUE,NULL,desired.display_order,
       '{"employee":true,"operations":true,"plant":true,"workspace":true}'::jsonb
FROM pdm CROSS JOIN desired
ON CONFLICT(workspace_id,catalogue_type,category,sub_category,item_name)
DO UPDATE SET default_priority=EXCLUDED.default_priority,
              priority_locked=TRUE,
              summary_locked=FALSE,
              is_other=FALSE,
              is_active=TRUE,
              archived_at=NULL,
              display_order=EXCLUDED.display_order,
              visibility=EXCLUDED.visibility,
              updated_at=NOW();

COMMIT;
