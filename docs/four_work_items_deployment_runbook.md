# Four Work-Items Deployment Runbook (WI1–WI4)

Covers the four work items from `.codeartsdoer/specs/atd_helpdesk_4_work_items/`:
WI1 Finance Manager multi-view dashboard · WI2 Error logger lifecycle fixes · WI3 PDM workspace completion · WI4 Ticket-issue catalogue restructure.

All sandbox-verifiable acceptance criteria passed with zero failing assertions (Phase 8). This runbook covers the out-of-sandbox steps: frontend production build, live-DB migration application, PM2 restart, end-to-end smoke, and DFX verification.

## 0. Pre-deploy probe suite (re-run before deploying)

From `atd-helpdesk/backend/`:

| Probe | Expected | Covers |
| --- | --- | --- |
| `node checkFourWorkItemsSyntax.cjs` | `FOUR_WORK_ITEMS_SYNTAX_OK` | 8 backend files + 4 migration files |
| `node probeFinanceManagerMultiView.cjs` | RESULT 14/14 | WI1 (spec 5.1) |
| `node probeErrorLoggerLifecycle.cjs` | RESULT 14/14 | WI2 (spec 5.2) |
| `node probePdmWorkspaceCompletion.cjs` | RESULT 15/15 | WI3 (spec 5.3) |
| `node probeCatalogueRestructure.cjs` | RESULT 16/16 | WI4 (spec 5.4) |
| `node probeFourWorkItemsFinalReview.cjs` | RESULT 19/19 | traceability + additive-only + migrations + interface inventory |
| `node probeManagementDashboard.cjs` | 37/37 PASS | baseline |
| `node probePhaseLRoutes.cjs` | RESULT 32/32 | baseline |
| `node probeRegressionSecurity.cjs` | RESULT 30/30 | baseline |
| `node probeFinalReview.cjs` | RESULT 45/45 | baseline |
| `node probeExtensionRoutes.cjs` | RESULT 27/27 | Part-1 extension baseline |
| `node probeExtensionFinalReview.cjs` | RESULT 43/43 | Part-1 extension baseline (asserts baseline 420/420 unchanged) |

## 1. Frontend production build

`npx vite build` could not run in the development sandbox (esbuild service terminates). All 10 touched JSX/JS files pass the babel parse check (`Temp/checkFrontendSyntax.cjs`). Before deploying:

```bash
cd atd-helpdesk/frontend
npx vite build
```

Acceptance: build exits 0. Touched files: `DashboardViewSwitcher.jsx`, `FinanceManagerDashboard.jsx`, `PdmKanbanBoard.jsx`, `PdmCompletionPanel.jsx`, `PdmOperationsDashboard.jsx`, `CatalogueHierarchyTree.jsx`, `WorkspaceCatalogueManager.jsx`, `TicketCreatePage.jsx`, `IncidentCatalogPage.jsx` (read-only contract), `api.js`.

## 2. Migrations (tasks 9.1)

Two forward migrations + rollback companions, both idempotent and data-preserving:

- Migration A: `2026-11-22-pdm-ticket-context-alignment.sql` (+ `-rollback.sql`) — adds the 5 spec §6.6 `pdm_ticket_context` columns (`process_stage`, `issue_type`, `production_impact`, `metadata JSONB NOT NULL DEFAULT '{}'`, `updated_at`) and repoints the `catalogue_item_id` FK to `workspace_catalogue_items(id) ON DELETE SET NULL`.
- Migration B: `2026-11-22-ticket-catalogue-link-reconciliation.sql` (+ `-rollback.sql`) — reconciles `tickets.catalogue_item_id` UUID→BIGINT+FK (deterministic regardless of prior `2026-11-05`/`2026-10-14` application order), adds `catalogue_item_name`, `catalogue_snapshot JSONB NOT NULL DEFAULT '{}'`, `catalogue_other_route BOOLEAN NOT NULL DEFAULT FALSE`, two partial indexes, and the one-time snapshot backfill (guarded by `catalogue_snapshot = '{}'`).

From `atd-helpdesk/backend/`:

```bash
node src/db/runMigration.js 2026-11-22-pdm-ticket-context-alignment.sql --validate-only
node src/db/runMigration.js 2026-11-22-pdm-ticket-context-alignment.sql --phase <n>
node src/db/runMigration.js 2026-11-22-pdm-ticket-context-alignment.sql --phase <n>   # re-run: must be a no-op (idempotency)

node src/db/runMigration.js 2026-11-22-ticket-catalogue-link-reconciliation.sql --validate-only
node src/db/runMigration.js 2026-11-22-ticket-catalogue-link-reconciliation.sql --phase <n>
node src/db/runMigration.js 2026-11-22-ticket-catalogue-link-reconciliation.sql --phase <n>   # re-run: must be a no-op
```

Staging rollback pass:

```bash
node src/db/runMigration.js 2026-11-22-pdm-ticket-context-alignment.sql --rollback 2026-11-22-pdm-ticket-context-alignment-rollback.sql
node src/db/runMigration.js 2026-11-22-ticket-catalogue-link-reconciliation.sql --rollback 2026-11-22-ticket-catalogue-link-reconciliation-rollback.sql
```

Post-apply acceptance checks (psql):

```sql
SELECT format_type(a.atttypid, a.atttypmod) FROM pg_attribute a
 WHERE a.attrelid='tickets'::regclass AND a.attname='catalogue_item_id' AND NOT a.attisdropped;   -- expected: bigint
SELECT COUNT(*) FROM pg_constraint WHERE conrelid='tickets'::regclass AND contype='f'
 AND confrelid='workspace_catalogue_items'::regclass;                                            -- expected: 1 (ON DELETE SET NULL)
SELECT column_name FROM information_schema.columns WHERE table_name='pdm_ticket_context'
 AND column_name IN ('process_stage','issue_type','production_impact','metadata','updated_at');  -- expected: 5 rows
```

Rollback notes: Migration B rollback deliberately retains `tickets.catalogue_item_id` as BIGINT and never touches `catalogue_item_id`/`catalogue_item_name` (a destructive UUID cast would lose data — documented in the rollback header). Rollback of B only drops `catalogue_snapshot`/`catalogue_other_route` when the shared-catalogue base migration is absent.

## 3. PM2 restart and end-to-end smoke (tasks 9.2)

```bash
pm2 restart <backend-process-name>   # or pm2 startOrReload ecosystem.config.js
```

Smoke scenarios (design §2.4):

1. **WI1 view switch**: open the Finance manager dashboard with a period selected, switch Management ↔ Ticket-Driven repeatedly — the network log must show no duplicate XHR (the fetch effect is keyed on `[period]` only) and the period stays selected. Refresh on `?view=ticket-driven` restores the Ticket-Driven view.
2. **WI2 dedup**: trigger the same frontend error twice within 5 minutes — the Error Logger list shows a single entry with `occurrenceCount` incremented and `lastOccurredAt` updated (60/min ingest rate limit still applies to fresh errors).
3. **WI3 context save**: on a PDM ticket, save ticket context (plant/line/station/machine/product family/process stage/issue type/production impact) — expect "PDM context saved and audit-ready." and a re-read returning the saved values. Pre-migration, the same save must return 503 `PDM_CONTEXT_SCHEMA_PENDING` (verify before applying Migration A if sequencing matters).
4. **WI4 catalogue create**: create a ticket from a catalogue item with `default_priority=High` — the created ticket carries priority High, the `catalogue_snapshot` values, and inherited group/assignee defaults. A `priority_locked` item ignores a client-supplied priority.
5. **WI4 archived-item path**: archive that catalogue item, then create another ticket from it — the ticket is created via the canonical Other item with `catalogue_other_route=TRUE` and the notice "This catalogue item has been archived. You can still raise a ticket using the general Other path."; previously created tickets keep their snapshot and priority (immutability). The item's linked-ticket drill-down still lists the historical tickets (fuzzy by-name mode).

## 4. DFX targets (tasks 9.3)

Verify at deploy under representative load:

- Finance manager view switch render ≤ 500ms (no refetch — pure re-render).
- Error Logger list (50/page) ≤ 2s.
- PDM dashboard initial load ≤ 3s (includes the `catalogueItems` count).
- Catalogue browse (hierarchy tree) ≤ 1s.
- Observe the 60/min ingest rate limit and the 100-entry buffer cap under error storms (buffered entries flush with `bypassRateLimit` and preserve correlation ids).

## 5. Code rollback (last resort)

All changes are additive-only (baseline regression 420/420 unchanged). Code rollback = revert the touched files listed in §1 plus the backend files in `checkFourWorkItemsSyntax.cjs`; schema rollback = §2 rollback companions. No baseline route, guard, or success response shape changed, so a partial rollback (e.g. WI4 only) is safe if its migration companion is rolled back first.