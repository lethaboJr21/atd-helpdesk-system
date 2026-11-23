# Finance/IT Database Separation — Rollback Runbook

> **Purpose**: Step-by-step rollback procedures for each phase of the Finance/IT database separation migration.
> **Audience**: DBA / DevOps engineer.
> **Prerequisite**: Access to the PostgreSQL `atd_helpdesk` database and the backend directory.

## Rollback Command Format

All rollbacks are executed from the `backend/` directory:

```bash
node src/db/runMigration.js <migration-filename> --phase <N> --rollback <rollback-filename>
```

---

## Phase 1 — Workspace Discipline

**Migration**: `2026-11-20-phase1-workspace-discipline.sql`
**Rollback**: `2026-11-20-phase1-workspace-discipline-rollback.sql`

### Pre-conditions
- Phase 1 has been applied (`schema_migrations` shows `validation_status='passed'`)
- No Phase 2-5 migrations have been applied (rollback Phase 5→2 first if needed)

### Rollback Command
```bash
node src/db/runMigration.js 2026-11-20-phase1-workspace-discipline.sql --phase 1 --rollback 2026-11-20-phase1-workspace-discipline-rollback.sql
```

### Post-Rollback Verification
- `tickets.workspace` column is nullable (NOT NULL removed)
- CHECK constraint `tickets_workspace_valid_code` is dropped
- Normalisation trigger `trg_normalise_ticket_workspace` is dropped
- `ticket_history.workspace` and `ticket_comments.workspace` columns are dropped
- Original workspace values restored from `tickets_workspace_backup`

---

## Phase 2 — Finance Column Migration

**Migration**: `2026-11-21-phase2-finance-column-migration.sql`
**Rollback**: `2026-11-21-phase2-finance-column-migration-rollback.sql`

### Pre-conditions
- Phase 2 has been applied
- Phase 3-5 have NOT been applied (or have been rolled back first)
- `DUAL_READ_ENABLED=true` in `.env` (so queries read from `tickets` after rollback)

### Rollback Command
```bash
node src/db/runMigration.js 2026-11-21-phase2-finance-column-migration.sql --phase 2 --rollback 2026-11-21-phase2-finance-column-migration-rollback.sql
```

### Post-Rollback Verification
- 9 migrated columns are dropped from `finance_ticket_operations`
- `tickets` columns remain as authoritative source
- `finance_migration_anomalies` table is dropped
- Finance queries return correct results from `tickets`

---

## Phase 3 — RLS + Database Roles

**Migration**: `2026-11-22-phase3-rls-roles.sql`
**Rollback**: `2026-11-22-phase3-rls-roles-rollback.sql`

### Pre-conditions
- Phase 3 has been applied
- Phase 4-5 have NOT been applied (or have been rolled back first)
- Set `RLS_ENABLED=false` in `.env` before restarting the application

### Rollback Command
```bash
node src/db/runMigration.js 2026-11-22-phase3-rls-roles.sql --phase 3 --rollback 2026-11-22-phase3-rls-roles-rollback.sql
```

### Post-Rollback Verification
- `relrowsecurity=false` on all 5 shared tables
- `relforcerowsecurity=false` on all 4 critical tables
- All 8 roles + `system_administrator` are dropped from `pg_roles`
- All RLS policies are dropped
- Application queries work without workspace session variables

---

## Phase 3b — Cross-Workspace Access Tables

**Migration**: `2026-11-22b-cross-workspace-access-tables.sql`
**Rollback**: `2026-11-22b-cross-workspace-access-tables-rollback.sql`

### Rollback Command
```bash
node src/db/runMigration.js 2026-11-22b-cross-workspace-access-tables.sql --phase 3 --rollback 2026-11-22b-cross-workspace-access-tables-rollback.sql
```

### Post-Rollback Verification
- `cross_workspace_access_exceptions` table is dropped
- `cross_workspace_access_log` table is dropped

---

## Phase 5 — Verification + Cleanup

**Migration**: `2026-11-23-phase5-cleanup.sql`
**Rollback**: `2026-11-23-phase5-cleanup-rollback.sql`

### Pre-conditions
- Phase 5 has been applied (6 Finance-only columns dropped from `tickets`)
- Set `DUAL_READ_ENABLED=true` in `.env` before restarting (so dual-read can function during rollback)

### Rollback Command
```bash
node src/db/runMigration.js 2026-11-23-phase5-cleanup.sql --phase 5 --rollback 2026-11-23-phase5-cleanup-rollback.sql
```

### Post-Rollback Verification
- 6 dropped columns are restored on `tickets` (nullable): `evidence_state`, `review_state`, `kpi_objective`, `kpi_period`, `baseline_assigned_at`, `closed_by`
- Column values are backfilled from `finance_ticket_operations` for Finance tickets
- 3 shared columns (`original_due_at`, `effective_due_at`, `closed_at`) remain unchanged
- `tickets_workspace_backup` and `finance_migration_anomalies` tables may be recreated

---

## Full Rollback (All Phases)

To roll back all phases to the pre-migration state, execute in reverse order:

1. Rollback Phase 5 (restore dropped columns)
2. Rollback Phase 3b (drop cross-workspace tables)
3. Rollback Phase 3 (drop RLS policies + roles)
4. Rollback Phase 2 (drop fto migrated columns)
5. Rollback Phase 1 (restore original workspace values)

**Set env vars to pre-migration state:**
```env
RLS_ENABLED=false
DUAL_READ_ENABLED=false
WORKSPACE_NORMALISATION_ENABLED=false
```

**Restart the application after each phase rollback to ensure consistency.**