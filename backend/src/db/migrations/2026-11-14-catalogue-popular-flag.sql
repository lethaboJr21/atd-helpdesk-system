BEGIN;
ALTER TABLE workspace_catalogue_items ADD COLUMN IF NOT EXISTS is_popular BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS workspace_catalogue_popular_idx
 ON workspace_catalogue_items(workspace_id, catalogue_type, is_popular)
 WHERE is_popular = TRUE AND is_active = TRUE AND archived_at IS NULL;

UPDATE workspace_catalogue_items SET is_popular = TRUE
 WHERE catalogue_type = 'service_request'
   AND LOWER(item_name) IN (
     'password reset','mailbox access','microsoft teams','vpn access',
     'dms access','omnex access','p2p application access','sharepoint access',
     'new ad / email account','account offboarding','laptop','desktop computer',
     'monitor','headset','keyboard and mouse','printer access'
   );

UPDATE workspace_catalogue_items SET is_popular = TRUE
 WHERE catalogue_type = 'incident'
   AND LOWER(item_name) IN (
     'network or wi-fi','computer or laptop','printer or scanner',
     'email or microsoft 365','syspro or erp','business application',
     'account or access problem'
   );
COMMIT;