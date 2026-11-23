BEGIN;

ALTER TABLE finance_ticket_operations
  ADD COLUMN IF NOT EXISTS finance_kpi_id BIGINT
  REFERENCES finance_kpis(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_finance_ticket_operations_kpi
  ON finance_ticket_operations(finance_kpi_id)
  WHERE finance_kpi_id IS NOT NULL;

COMMIT;
