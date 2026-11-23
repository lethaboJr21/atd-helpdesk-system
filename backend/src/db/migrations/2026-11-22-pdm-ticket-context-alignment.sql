BEGIN;

ALTER TABLE pdm_ticket_context
  ADD COLUMN IF NOT EXISTS process_stage TEXT,
  ADD COLUMN IF NOT EXISTS issue_type TEXT,
  ADD COLUMN IF NOT EXISTS production_impact TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
DECLARE
  legacy_fk TEXT;
BEGIN
  IF to_regclass('workspace_catalogue_items') IS NOT NULL THEN
    SELECT conname INTO legacy_fk
    FROM pg_constraint
    WHERE conrelid = 'pdm_ticket_context'::regclass
      AND contype = 'f'
      AND confrelid = 'pdm_catalogue_items'::regclass;
    IF legacy_fk IS NOT NULL THEN
      EXECUTE format('ALTER TABLE pdm_ticket_context DROP CONSTRAINT %I', legacy_fk);
    END IF;
    UPDATE pdm_ticket_context
    SET catalogue_item_id = NULL
    WHERE catalogue_item_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM workspace_catalogue_items w WHERE w.id = pdm_ticket_context.catalogue_item_id
      );
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'pdm_ticket_context'::regclass
        AND contype = 'f'
        AND confrelid = 'workspace_catalogue_items'::regclass
    ) THEN
      ALTER TABLE pdm_ticket_context
        ADD CONSTRAINT pdm_ticket_context_catalogue_item_id_fkey
        FOREIGN KEY (catalogue_item_id) REFERENCES workspace_catalogue_items(id) ON DELETE SET NULL;
    END IF;
  END IF;
END
$$;

COMMIT;