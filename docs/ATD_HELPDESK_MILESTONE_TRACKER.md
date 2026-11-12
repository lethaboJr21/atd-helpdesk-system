# ATD Helpdesk Milestone Tracker

Purpose: weekly completed-work register. Active/incomplete work remains in the development task tracker. Completed work is copied into this milestone dataset, preserving the source task history while making weekly reporting filterable and exportable.

## Production server baseline
- Server: 10.0.0.12
- SSH port: 18922
- Deployment account: atddev
- Repository/runtime root: /var/www/atd-helpdesk
- Public Helpdesk roots: /var/www/helpdesk and /var/www/production

## Weekly milestone summary
### Week of 2026-10-26
- [Completed] **Core Helpdesk**: Public Helpdesk frontend activation through protected www-data roots
- [Completed] **Core Helpdesk**: Signup/Auth production deployment and governed authentication migration
- [Completed] **Core Helpdesk**: Ticket attachment Browse files repair
- [Completed] **Finance/PDM**: Finance reminder, classified communication and participant access controls deployed
- [Completed] **Finance/PDM**: Finance task collaboration schema and API: owner, assistant, reviewer, submission and review
- [Completed] **Finance/PDM**: Finance/PDM task monitoring UI and shared governed task model
- [Completed] **Finance/PDM**: Finance/PDM workspace routes activated with non-404 production validation
- [Completed] **Task Tracker**: `183` Source and schema checkpoint plus developer tracker
- [Completed] **Task Tracker**: `184` Ticket review before final submission
- [Completed] **Task Tracker**: `185` Priority SLA policy, response target, resolution target, persistence and history
- [Completed] **Task Tracker**: `186` Requester, Support Group and proposed-assignee governed email workflow
- [Completed] **Task Tracker**: `187` Email replies, reference matching, idempotency and recipient switching
- [Completed] **Task Tracker**: `188` Pending acceptance cards, priority ordering and hover/focus previews
- [Completed] **Task Tracker**: `189` Reusable sticky header, scrollable body and sticky footer list shell
- [Completed] **Task Tracker**: `190` Ticket activity floating popup with participant and timestamp
- [Completed] **Task Tracker**: `191` Transaction-safe Undo for supported reversible changes

## Reporting model
The JSON and CSV companions are the reusable data sources for filtering/grouping and Excel export. Planned Helpdesk implementation will persist the same fields in governed milestone records and expose preview-first report export.

## 2026-11-01 Login-options repair + morning reminder reporting batch
- Production login error 'Sign-in options could not be loaded' is included in the guarded production diagnosis/deployment gate and validates both /api/auth/login-options and /helpdesk/api/auth/login-options before source activation.
- Morning reminder reporting now has a reusable 7-day age model: New <7 days and Older >=7 days, with overdue, due-today, awaiting-review and unassigned summaries.
- The reminder structure is intended for email cards, dashboard preview, filtering and Excel/report exports.

## 2026-11-02 Complete backend dependency sync and login deployment
- The previous isolated-file deployment was replaced by complete backend/src synchronization after validating every JavaScript file and the previously missing Finance/workspace dependencies.
- Production validates npm dependencies, PM2 stability, port 3001, direct/public login-options, and all required workspace routes before retaining changes.
- Automatic rollback protects backend source, frontend roots, Apache configuration, and PM2 runtime.

## 2026-11-02 Assignment and catalogue foundation repair
- Restored and verified the agent work-preferences and shared workspace catalogue schema foundations.
- Recovery validation skips already-present relations, checks the live PM2 process and non-5xx authenticated endpoints, and does not treat historical pre-migration PM2 log entries as fresh failures.
- Follow-on batch: requester/beneficiary workflow, governed IT assignees, simplified assignee selector, and default IT Helpdesk landing with governed Finance switching.

## 2026-11-12 Consolidated delivery plan: two batches

### Current validated baseline
- Script 1024 V2: canonical PDF workflow alignment preflight passed and frontend production build passed.
- Script 1025: IT/Finance workspace isolation preflight passed. Preserve explicit IT Ticket Workspace scope and Finance-only scope. Finance employees may retain ordinary Helpdesk access, but Finance tickets must not enter the IT operational queue.
- Script 1026: earlier 1027-1033 queue was documentation-only. This entry supersedes that queue and combines the work into two controlled implementation batches.
- Script 1027 preflight: current build is clean. RequestEntryMenu already supports beneficiary self/other choice and a quick Incident catalogue; TicketCreate already supports managedCatalogueItemId, governed title/priority locks, request-for-someone-else validation and workspace catalogue resolution. RequestCatalog uses getManagedItServices. Backend users route supports search. Tickets backend preserves requester_id as beneficiary and created_by_user_id as authenticated creator.
- Outstanding visible defects: true employee selection is not yet performed before module navigation; catalogue=other&blank=true can still drift into a managed Incident classification; Service/Asset catalogue fetch remains slower than desired and has no shared session cache; remaining TicketCreate mojibake must be removed; Catalogue Manager needs workspace-centric simplification and scoped authorization.

### BATCH A - Canonical Helpdesk Workflow + Catalogue Platform (combine former 1027-1032)
Priority: P0/P1 combined implementation, local-first, one regression gate before deployment.

1. Canonical New Request flow from Helpdesk Ticket workflow.pdf
   - Step 1: Ticket for Myself / For Someone Else.
   - For Someone Else: searchable employee selector BEFORE request type/module navigation; carry concrete beneficiary/requester user ID, not only beneficiary=other.
   - Step 2: request type selection.
2. Incident fast path
   - Quick Incident choices backed by managed catalogue IDs where exact.
   - Browse All Incidents: Category -> Sub-category -> Item.
   - Managed selection coherently governs managedCatalogueItemId, Category, Sub-category, Item, Short Summary and locked Priority.
   - Other is a true blank/manual IT Incident: no managed item, blank classification/title, editable fields.
3. Service / Asset fast path
   - Immediate common Service cards and Browse All Service Catalogue.
   - One authenticated managed service_request fetch per short session/TTL cache; Service and Asset share the same cached records.
   - Asset remains the Hardware /Equipment + Asset * subset.
   - Catalogue UI must not block initial interaction while full catalogue loads.
4. Catalogue Manager simplification
   - Service Catalog-style UI: workspace selector, catalogue type, search, left category navigation, managed item cards, one obvious Add Item control.
   - Workspace managers see items for authorised workspace(s) and can add/edit/duplicate/reorder/activate/archive there.
   - Superadmin sees All Workspaces and can switch across every configured service_workspaces record.
   - Backend authorization is authoritative; hiding options in React is not sufficient.
   - Employee catalogue and Catalogue Manager use the same workspace_catalogue_items records; no shadow catalogue.
   - Create/update/status/reorder operations invalidate/bump the managed catalogue cache.
5. Encoding cleanup
   - Replace remaining TicketCreate user-facing mojibake with intended ASCII-safe wording; no repository-wide transcoding.
6. Hard workspace invariant
   - New IT tickets use IT operational ownership; IT Ticket Workspace remains explicit workspace=IT.
   - Finance creation/work remains Finance-scoped. Access rights never merge queues.
   - Preserve Major Incident -> Critical, SLA, requester/creator attribution, Support Team/proposed Agent, Accept and Action, attachments, duplicate prevention and 7-day reopen.
7. Batch A acceptance
   - baseline build, post-build, backend syntax, DB catalogue counts, ordinary employee + operations acceptance, IT/Finance isolation preflight repeated.

### BATCH B - Finance Workspace Dashboard + Approval/KPI Governance (combine former 1033 plus queued Finance requirements)
Priority: starts immediately after Batch A acceptance/freeze.

1. Finance access/navigation
   - Finance employees get obvious Finance Workspace access while retaining ordinary Employee Helpdesk.
   - Assigned Finance tickets/tasks are openable/respondable by authorised assignees without leaking Finance queue data into IT.
2. Finance employee dashboard
   - My Tickets/Tasks, Journals, Reconciliations, Month-End, returned items, evidence required, due soon, overdue, email attention and My KPI.
3. Finance manager dashboard
   - Team workload, overdue by employee, awaiting review, review-overdue, evidence queue, extensions/dependencies, quality ratings, timeliness, KPI risk and portfolio drill-down.
4. Approval routing
   - Journals/Recons/Month-End/Tickets use existing governed workflows and audit history.
   - Portfolio first-review routing uses real directory identities/configuration rather than hard-coded UI names.
   - Reject/Return sends work back to assignee with reason/history.
   - No-review-required is a governed exemption with reason, approver and timestamp.
   - Final approval paths support Finance Manager/AP Manager/CFO policy.
5. KPI linkage
   - Every Finance ticket/task, Journal, Recon and Month-End item links to a KPI objective/period where applicable.
   - Item scoring: Timeliness 50% + Quality 50%.
   - Late without approved extension loses timeliness component; approved external-department dependency can adjust effective due date/restore governed time credit.
   - Reviewer timeliness is separately measurable and affects reviewer KPI where review is overdue.
   - Periods: Monthly, Quarterly, Biannual, Annual, Custom.
6. Existing KPI objective model to preserve/integrate
   - Month-End Close 30%.
   - Reconciliation Control 25%.
   - Cut-off Accuracy 15%.
   - Financial Reporting Quality 20%.
   - Internal Finance Service Delivery 10%.
7. Supporting evidence/reminders
   - Reuse ticket attachments/Finance evidence infrastructure for Tickets, Journals, Recons and Month-End.
   - Email reminders for assigned, due soon, overdue, awaiting review, review overdue, returned, extension decision and final approval.
8. Batch B acceptance/deployment
   - Finance employee + manager authenticated regression, IT isolation regression, then controlled production deployment and closeout report.
   - After Finance deployment: move active development scope to Process Engineering.

### Continuity / deployment lessons that must be retained
- Production PM2 service: /etc/systemd/system/pm2-atdadmin.service; runtime user atdadmin; PM2_HOME=/home/atdadmin/.pm2; backend entry /var/www/atd-helpdesk/backend/src/server.js; listener 127.0.0.1:3001.
- Production outage root cause during deployment: backend/src was restored as private drwx------ atddev:atddev, so atdadmin could not traverse/read server.js. Runtime recovered only after normalising backend/src group/traversal permissions and targeted-restarting atd-helpdesk-api.
- Future deployment/rollback must preserve backend/src traversal for atdadmin (production group semantics) before PM2 restart.
- Do not use cp -a as unprivileged atddev where preserving www-data/root metadata is not permitted.
- Do not run npm audit fix --force during deployment. Production npm install reported 12 vulnerabilities (1 moderate, 10 high, 1 critical); remediate separately with regression testing.
- Do not run historical DB migrations blindly. Current deployment/recovery intentionally skipped migrations.
- Keep rollback backups and update trackers after every implementation/validation/deployment batch.
