DROP INDEX IF EXISTS ix_finance_ticket_operations_kpi;
ALTER TABLE finance_ticket_operations
  DROP COLUMN IF EXISTS finance_kpi_id;
