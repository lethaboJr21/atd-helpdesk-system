BEGIN;

DO $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO col_type
  FROM pg_attribute a
  WHERE a.attrelid = 'tickets'::regclass
    AND a.attname = 'catalogue_item_id'
    AND NOT a.attisdropped;
  IF col_type = 'uuid' THEN
    CREATE TEMP TABLE ticket_catalogue_link_reconciliation_map ON COMMIT DROP AS
      SELECT t.id ticket_id, w.id catalogue_item_id
      FROM tickets t
      JOIN workspace_catalogue_items w ON w.id::text = t.catalogue_item_id::text;
    ALTER TABLE tickets DROP COLUMN catalogue_item_id;
    ALTER TABLE tickets ADD COLUMN catalogue_item_id BIGINT REFERENCES workspace_catalogue_items(id) ON DELETE SET NULL;
    UPDATE tickets t
    SET catalogue_item_id = m.catalogue_item_id
    FROM ticket_catalogue_link_reconciliation_map m
    WHERE t.id = m.ticket_id;
  ELSIF col_type IS NULL THEN
    ALTER TABLE tickets ADD COLUMN catalogue_item_id BIGINT REFERENCES workspace_catalogue_items(id) ON DELETE SET NULL;
  END IF;
END
$$;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS catalogue_item_name TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS catalogue_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS catalogue_other_route BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tickets_catalogue_item_id
  ON tickets(catalogue_item_id)
  WHERE catalogue_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_catalogue_item_name
  ON tickets(catalogue_item_name)
  WHERE catalogue_item_name IS NOT NULL;

UPDATE tickets t
SET catalogue_snapshot = jsonb_build_object(
  'category', w.category,
  'subCategory', w.sub_category,
  'itemName', w.item_name,
  'defaultPriority', w.default_priority,
  'slaPolicyKey', w.sla_policy_key,
  'defaultGroupId', w.default_group_id,
  'defaultAssigneeUserId', w.default_assignee_user_id,
  'snapshotAt', NOW()
)
FROM workspace_catalogue_items w
WHERE t.catalogue_item_id = w.id
  AND t.catalogue_snapshot = '{}'::jsonb;

COMMIT;