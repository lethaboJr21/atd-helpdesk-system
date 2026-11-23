-- Data-preserving retention: tickets.catalogue_item_id stays BIGINT (a destructive cast back to UUID would lose data) and catalogue_item_id/catalogue_item_name values are untouched.
BEGIN;

DO $$
DECLARE
  link_fk TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM schema_migrations
    WHERE filename = '2026-10-14-shared-workspace-catalogue-manager.sql'
  ) THEN
    SELECT conname INTO link_fk
    FROM pg_constraint
    WHERE conrelid = 'tickets'::regclass
      AND contype = 'f'
      AND confrelid = 'workspace_catalogue_items'::regclass;
    IF link_fk IS NOT NULL THEN
      EXECUTE format('ALTER TABLE tickets DROP CONSTRAINT %I', link_fk);
    END IF;
    ALTER TABLE tickets DROP COLUMN IF EXISTS catalogue_snapshot;
    ALTER TABLE tickets DROP COLUMN IF EXISTS catalogue_other_route;
  END IF;
END
$$;

COMMIT;