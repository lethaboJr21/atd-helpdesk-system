BEGIN;

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS catalogue_item_id UUID;

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS catalogue_item_name TEXT;

CREATE INDEX IF NOT EXISTS idx_tickets_catalogue_item_id
  ON tickets(catalogue_item_id)
  WHERE catalogue_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_catalogue_item_name
  ON tickets(catalogue_item_name)
  WHERE catalogue_item_name IS NOT NULL;

COMMIT;
