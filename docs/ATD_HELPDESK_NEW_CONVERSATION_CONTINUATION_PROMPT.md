# ATD Helpdesk Development Continuation Prompt

Continue the ATD Helpdesk project from the repository and project trackers. Treat the repository source plus the tracker files as authoritative current state. Do not reconstruct old assumptions when a tracker/report or current source can be inspected.

## Mandatory operating procedure
1. Start with a read-only preflight. Record current Git branch/HEAD/status, relevant source hashes, backend syntax, frontend production build, DB/read-only contract checks where applicable, and current production/runtime state if deployment-related.
2. Before source-changing scripts, inspect exact current source shape. Avoid brittle byte-identical or broad regex rewrites.
3. Every modifying script must: create timestamped backup(s); make the narrowest change possible; validate syntax/build; rollback automatically on failure; write a report under `reports/`; and update project tracker/continuity files with completed work, changed files, validation results, outstanding issues, and next-agent notes.
4. Use ASCII-safe PowerShell source. Do not embed mojibake patterns directly in `.ps1`; use numeric Unicode code points or semantic literal rewrites.
5. For remote shell operations, upload LF-only `.sh` scripts and execute explicitly through `bash -n` then `bash`. Do not rely on SSH `/bin/sh` for `set -o pipefail`.
6. Production deployment must preserve `/var/www/atd-helpdesk/backend/.env`, uploads, database data, and rollback backups. Do not blindly run historical migrations. Do not use `npm audit fix --force` during deployment.
7. Preserve production runtime permissions: PM2 service `/etc/systemd/system/pm2-atdadmin.service`, runtime user `atdadmin`, `PM2_HOME=/home/atdadmin/.pm2`, backend `/var/www/atd-helpdesk/backend/src/server.js`, listener `127.0.0.1:3001`. Backend `src` must remain traversable/readable by `atdadmin`; previous `drwx------ atddev:atddev` caused a PM2 crash loop and Apache 503.
8. Preserve hard ticket isolation: IT Ticket Workspace is explicitly IT-scoped; Finance Workspace is Finance-scoped. Finance employees may use ordinary employee Helpdesk, but Finance ticket records must not leak into the IT operations queue.

## Current two-batch delivery plan
### Batch A: Canonical Helpdesk Workflow + Catalogue Platform
Use `Helpdesk Ticket workflow.pdf` as canonical UX/process reference.
- New Request: Myself / Someone Else. Someone Else must search/select a concrete active employee before request-type navigation and carry the beneficiary/requester ID.
- Incident: quick managed choices + Browse All Incident catalogue + genuine blank editable Other path.
- Managed Incident selection coherently governs `managedCatalogueItemId`, Category, Sub-category, Item, Short Summary and locked Priority.
- Service: immediate common requests plus Browse All; do not block initial interaction on the full catalogue.
- Service/Asset performance: one authenticated managed service-request fetch per short TTL/session cache; Asset shares the same data and filters the managed Asset branches.
- Catalogue Manager: simplify to a Service-Catalog-style workspace-first interface with search, category navigation, cards, Add/Edit/Duplicate/Reorder/Activate/Archive. Workspace managers see authorized workspace(s); superadmin sees All Workspaces and may switch across configured `service_workspaces`. Backend permission enforcement is authoritative.
- Catalogue Manager mutations invalidate/bump employee catalogue cache. Manager and employee catalogue use the same `workspace_catalogue_items` data.
- Remove remaining user-facing mojibake via targeted ASCII-safe semantic rewrites.
- Preserve Major Incident -> Critical/SLA, assignments, Accept and Action, requester/creator attribution, attachments, duplicate prevention, seven-day reopen, and IT/Finance queue isolation.

### Batch B: Finance Workspace Dashboard + Approval/KPI Governance
- Finance employees get obvious Finance Workspace access while retaining normal Helpdesk.
- Finance Employee Dashboard: My Tickets/Tasks, Journals, Recons, Month-End, returned/evidence/due/overdue/email/KPI.
- Finance Manager Dashboard: team workload, overdue/review queues, evidence, extensions/dependencies, quality, timeliness, KPI risk and portfolio drill-down.
- Journal/Recon/Month-End/Ticket workflows use existing governed approval/audit infrastructure. Reviewer routing should be configuration/real-user-ID driven, not hard-coded display names.
- Reject/Return sends work back with reason/history. No-review-required is governed by reason/approver/timestamp.
- KPI item score: Timeliness 50% + Quality 50%. Approved external-department dependency may adjust the effective deadline; reviewer lateness affects reviewer KPI separately.
- KPI periods: Monthly, Quarterly, Biannual, Annual, Custom.
- Existing KPI objective model: Month-End Close 30%; Reconciliation Control 25%; Cut-off Accuracy 15%; Financial Reporting Quality 20%; Internal Finance Service Delivery 10%.
- Reuse existing ticket attachment/Finance evidence infrastructure and add due/review/return/extension/final-approval reminders.
- After Finance acceptance/deployment, move active development to Process Engineering.

## Reports and tracker style
- Scripts are numbered sequentially (`script_NNNN_description.ps1`) with timestamped report names.
- Reports should state MODE, source/DB writes, backup path, preflight facts, exact patch/change, validation output, rollback state, final STATUS, report path.
- Tracker entries should be concise but operationally complete: context/root cause, changed files, preserved contracts, validation evidence, deployment/rollback status, outstanding work, exact next step.

## Git/GitHub continuation
Before pushing, inspect `git remote -v`, branch, status, and secret-like files. Never push `.env`, credentials, private keys, production dumps, uploaded evidence, or generated `node_modules/dist/reports/backups` unless intentionally tracked. Prefer committing source, migrations deliberately reviewed, docs/trackers, reusable scripts, and this continuation prompt. Record the Git commit hash and branch in the project tracker after a successful push.
