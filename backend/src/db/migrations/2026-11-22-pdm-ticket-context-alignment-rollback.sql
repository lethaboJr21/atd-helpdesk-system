BEGIN;

DO $$
DECLARE
  repointed_fk TEXT;
BEGIN
  SELECT conname INTO repointed_fk
  FROM pg_constraint
  WHERE conrelid = 'pdm_ticket_context'::regclass
    AND contype = 'f'
    AND confrelid = 'workspace_catalogue_items'::regclass;
  IF repointed_fk IS NOT NULL THEN
    EXECUTE format('ALTER TABLE pdm_ticket_context DROP CONSTRAINT %I', repointed_fk);
  END IF;
  IF to_regclass('pdm_catalogue_items') IS NOT NULL THEN
    UPDATE pdm_ticket_context
    SET catalogue_item_id = NULL
    WHERE catalogue_item_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM pdm_catalogue_items p WHERE p.id = pdm_ticket_context.catalogue_item_id
      );
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'pdm_ticket_context'::regclass
        AND contype = 'f'
        AND confrelid = 'pdm_catalogue_items'::regclass
    ) THEN
      ALTER TABLE pdm_ticket_context
        ADD CONSTRAINT pdm_ticket_context_catalogue_item_legacy_fkey
        FOREIGN KEY (catalogue_item_id) REFERENCES pdm_catalogue_items(id);
    END IF;
  END IF;
END
$$;

ALTER TABLE pdm_ticket_context
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS production_impact,
  DROP COLUMN IF EXISTS issue_type,
  DROP COLUMN IF EXISTS process_stage;

COMMIT;