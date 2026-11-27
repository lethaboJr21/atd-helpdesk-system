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
Status: **IMPLEMENTED** (2026-11-14) — code complete, unit tests written, pending deployment validation.

#### Implemented components
1. **Database schema (4 migrations)**
   - `2026-11-14-finance-work-item-kpi-extension.sql`: KPI/due-date columns on tickets, journals, reconciliations, close_tasks + backfills + indexes
   - `2026-11-14-finance-kpi-scoring-tables.sql`: finance_kpi_objectives, finance_kpi_item_scores, finance_kpi_objective_aggregates, finance_kpi_periods, finance_kpi_score_audit + seed data (30/25/15/20/10)
   - `2026-11-14-finance-approval-routing-extension.sql`: finance_approval_routing_rules, finance_extension_requests, finance_review_exemptions
   - `2026-11-14-finance-reminder-extension.sql`: assignment_cycle, finance_reminder_thresholds, idempotency index

2. **Backend services (4 new)**
   - `financeKpiScoring.js`: Timeliness 50%+Quality 50% formula, objective aggregation, risk projection, recalculation
   - `financeApprovalRouting.js`: Rule-based resolver with SoD checks, backup approver fallback, escalation queue
   - `financeExtensionService.js`: Create/decide extension requests, effective_due_at update, original_due_at preservation
   - `financeReviewExemption.js`: Grant/revoke exemptions with audit, review_state management

3. **Extended routes (8 new endpoints)**
   - `GET /my-kpi`, `GET /kpi-scores`, `POST /kpi-scores/recalculate`, `GET /kpi-objectives`
   - `POST /extensions`, `POST /extensions/:id/decision`
   - `POST /approvals/:type/:id/exempt`
   - `GET /portfolios/:portfolio/items`, `GET /reminders/status`
   - Extended `/my-work` to 9 metrics with journals/reconciliations/email attention

4. **Reminder service (5 new types)**
   - overdue, review_overdue, returned, extension_decision, final_approval
   - Collision handling: overdue > due_24h > review_overdue > half_elapsed

5. **Frontend**
   - FinanceEmployeeDashboard: 9 metrics, journals/recons sections, email attention lane, My KPI with trend
   - Shared utilities: financeShared.js (csvExport, deriveWorkItemFlags, formatFinanceDate, workItemTone)
   - Shared components: SummaryMetricGrid.jsx, WorkItemCard.jsx
   - API methods: 10 new methods for all new endpoints

6. **Unit tests (5 test files)**
   - financeKpiScoring.test.js, financeApprovalRouting.test.js, financeExtensionService.test.js, financeReviewExemption.test.js, financeShared.test.js
   - Integration test skeleton: financeWorkspace.test.js

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

## 2026-11-14 Master Project Plan and DevOps Continuity Update

### Current delivery structure
The remaining ATD Helpdesk programme is consolidated into two primary implementation batches, followed by Process Engineering.

### BATCH A - Canonical Helpdesk Workflow + Catalogue Platform
Canonical reference: Helpdesk Ticket workflow.pdf.

#### New Request / beneficiary
- New Request begins with Ticket for Myself / For Someone Else.
- For Someone Else must search and select a concrete active employee before request-type/module navigation; ticket requester_id is beneficiary and created_by_user_id is authenticated creator.
- Request types remain Incident, Service Request, Asset Request, Change and Project according to governed module configuration.

#### Incident
- Quick Incident choices for common issues plus Browse All Incidents.
- Browse All: Category -> Sub-category -> exact Item.
- Managed item coherently governs managedCatalogueItemId, Category, Sub-category, Item, Short Summary and locked Priority where configured.
- Other is a genuine blank editable IT Incident: no managed item; blank classification/title until employee selects/enters values.
- Major Incident remains Critical with governed SLA; duplicate detection, attachments, Support Team/proposed Agent, Accept and Action and seven-day reopen remain preserved.

#### Service / Asset performance
- Quick Service cards render immediately; Browse All loads managed catalogue progressively.
- One authenticated managed service-request fetch is cached for a short session/TTL and shared by Service and Asset.
- Asset remains authoritative Hardware /Equipment plus Asset* subset.
- Catalogue Manager mutations invalidate/bump the client/server catalogue version/cache.

#### Catalogue Manager
- Simplify to Service-Catalog-style workspace-first administration: Workspace, Catalogue Type, Search, category navigation, managed item cards, Add Item.
- Existing items for selected department/workspace appear immediately.
- Add/Edit/Duplicate/Reorder/Activate/Deactivate/Archive functions remain governed.
- Workspace managers see only authorised workspace(s).
- Superadmin sees All Workspaces and switches across all configured service_workspaces; backend authorization is authoritative.
- Manager and employee catalogues consume the same workspace_catalogue_items records.

#### Isolation
- IT Ticket Workspace remains explicitly IT scoped.
- Finance Workspace remains Finance scoped.
- Finance employees can use ordinary Helpdesk, but Finance records never enter the IT operational queue merely because the employee has both access paths.

### BATCH B - Finance Employee/Manager Workspace + Review/KPI Governance

#### Finance Employee Dashboard / My Finance Work
- Dedicated Finance Employee Dashboard showing personal governed work only.
- Summary: Open, Due Today, Due This Week, Overdue, Returned, Awaiting Review, Evidence Required, Due in 24h, 50%+ elapsed.
- Work lanes: Finance Tickets/Tasks, Journals, Reconciliations, Month-End, Finance Email/Correspondence actions.
- Per-item tracker: reference, title, Finance Function/portfolio, status, priority, assigned date/baseline, original/effective due date, elapsed-time percentage/progress bar, evidence state, review state, KPI objective/period.
- Quick actions: Open, Add Evidence, Add Progress/Task Note, Clarification, Submit for Review, View Reviewer Feedback, Correct Returned Work.
- Generic ticket detail authorization must allow a directly assigned employee with active Finance responsibility/scope to open and contribute to assigned Finance tickets without exposing unrelated Finance work.

#### Finance reminders
- Assignment email once when responsibility/delegation becomes effective.
- 50%-elapsed reminder once when at least half of the effective assignment-to-due window is consumed and item remains incomplete.
- 24-hour reminder once when <=24 hours remain and item remains incomplete.
- Existing overdue and review-overdue reminders stay separate.
- Reminder events are server-side and idempotent per work item/current assignee/event; browser does not need to be open.
- Approved extension changes effective due date used by progress bar, reminders and timeliness KPI; original due date remains auditable.
- Reassignment transfers reminder ownership and generates a new assignment event for new assignee.
- Completed/Closed/Resolved/Accepted/Cancelled work receives no due reminders.
- Very short windows suppress duplicate reminder bursts; prefer most urgent unsent event when thresholds collide.
- Email uses existing Microsoft Graph/system-email infrastructure and records send success/failure.

#### Finance Review Centre
- Unified review queue for Finance tickets/tasks, Journals, Reconciliations and Month-End.
- Views: Awaiting My Review, Review Overdue, Returned, Approved, All.
- Actions: Approve, Return, Reject, Extension decision, governed No Review Required exemption.
- No-review exemption requires reason, approver and timestamp.
- Reviewer routing is real-user/configuration driven, not hard-coded display-name logic.
- Separation of duties, evidence requirements and full audit history remain mandatory.

#### Finance KPI
- Per accountable work item: Timeliness 50% + Quality 50%.
- Approved dependency/extension adjusts effective due date; late without approved adjustment loses timeliness component.
- Reviewer delay affects reviewer KPI independently from preparer KPI.
- Periods: Monthly, Quarterly, Biannual, Annual, Custom.
- Objective model: Month-End Close 30%; Reconciliation Control 25%; Cut-off Accuracy 15%; Financial Reporting Quality 20%; Internal Finance Service Delivery 10%.
- Employee KPI dashboard shows supporting work; manager dashboard shows team workload, overdue/review queues, extensions, evidence, quality, timeliness and KPI risk with drill-down.

### Project-wide planned capabilities after Finance
- Process Engineering/PDM workspace becomes the next active development area after Finance deployment.
- Continue shared workspace patterns: governed access, workspace catalogue, personal work dashboard, manager dashboard, evidence, approval/review, KPI/task tracking where applicable.
- Preserve company communications/announcements, Knowledge Base, Assets, Access Requests, archive/retention, audit, notifications and system email controls already present in platform.

### GitHub / clone continuation
- GitHub continuation repository: https://github.com/lethaboJr21/atd-helpdesk-system.git
- Development branch checkpoint: feature/launch-communications-queue-compatibility.
- Continuation prompt: docs/ATD_HELPDESK_NEW_CONVERSATION_CONTINUATION_PROMPT.md.
- Fresh conversation/device workflow: clone repository; checkout active branch; read continuation prompt + ATD_HELPDESK_DEVELOPMENT_TRACKER.md; run read-only preflight before modifying source.
- Never commit .env, credentials/private keys, node_modules, production uploads/evidence, DB dumps, deployment backups or transient reports unless deliberately promoted as sanitized documentation.

### DevOps operating procedure
- Every script must locate/validate the actual ATD Helpdesk repository root before acting. Never assume current PowerShell directory is the project.
- Source-changing batches: timestamped backup, exact source-shape preflight, narrow patch, backend syntax/frontend build validation, automatic rollback, report under reports/, tracker continuity update.
- Use ASCII-safe PowerShell. Remote shell: upload LF-only .sh, bash -n, then explicit bash execution; do not rely on /bin/sh for pipefail.
- Production: preserve backend/.env, uploads and database. Do not blindly run historical migrations. Do not run npm audit fix --force during deployment.
- Production runtime: /etc/systemd/system/pm2-atdadmin.service; user atdadmin; PM2_HOME=/home/atdadmin/.pm2; backend /var/www/atd-helpdesk/backend/src/server.js; listener 127.0.0.1:3001.
- Deployment permission invariant: backend/src must remain traversable/readable by atdadmin. Previous private drwx------ atddev:atddev caused MODULE_NOT_FOUND, PM2 crash loop and Apache 503. Normalize/preserve production group/traversal before PM2 restart.
- Avoid unprivileged cp -a where root/www-data metadata cannot be preserved. Verify runtime process, port 3001 and protected API 401/403 after restart.
- Update tracker files after every meaningful implementation/validation/deployment with root cause/context, changed files, validation results, rollback/deployment status, outstanding issues and exact next step.

### Current immediate next steps
1. Re-run Finance B1 implementation from the actual atd-helpdesk repository root. The prior attempt from C:\Users\jeffrey.motepe\IdeaProjects\ATDTraceability failed before modifications because backend/src/routes/tickets.js was absent there.
2. Finance B1: assigned-ticket generic access + Finance Employee Dashboard/My Finance Work.
3. Finance B1C: server-side assignment/50%-elapsed/24h reminder implementation using existing mail infrastructure and reminder history.
4. Continue Batch A canonical Helpdesk workflow/catalogue changes in parallel, then joint IT/Finance isolation regression.
5. Implement Finance Review Centre and KPI/dashboard layers, controlled deployment/report closeout, then Process Engineering.
## 2026-11-17 - Catalogue-first Incident and Other governance update
- Managed Incident Catalogue is the classification authority for Report an Incident.
- Normal Incident entry routes through `/incidents/catalogue`; direct `/incidents/new` requires a governed managed catalogue item.
- Legacy Incident Common Issues and editable Incident Category/Sub-category/Item classification were removed from the managed Incident flow.
- Major Incident controls, Impact/Urgency, governed Priority, assignment, attachments, review, SLA, history, and catalogue persistence remain in scope.
- Incident Catalogue now reuses Service Request catalogue icons, preferring governed `icon_key` metadata and using shared semantic fallbacks.
- New rule: every active Incident and Service Request catalogue branch must contain exactly one active governed `Other` item.
- `Other` is maintained by Workspace Catalogue Manager and remains tied to workspace, catalogue type, category, and sub-category.
- Migration prepared: `2026-11-17-one-other-per-catalogue-branch.sql`; it has NOT been executed yet.
- Database changes for this batch: none yet. Build/deployment/Git write: not executed.
- Production Service Catalogue outage root cause was missing `workspace_catalogue_items.is_popular`; the targeted popularity migration was applied on production and the exact managed popular-items query returned seven Service Request records.
- Next gate: validate and execute the one-Other migration in a governed transaction, then run local Incident/Service catalogue and ticket-creation regression checks before build/deployment.

## 2026-11-17 - Scripts 1039/1040 + catalogue-first ticketing checkpoint

### Script 1039 - combined ticket/catalogue discovery + Finance My Work attempt
- Scope recorded existing user-added ticket/catalogue files as the current baseline while attempting a Finance My Work expansion.
- Baseline backend syntax checks passed for Finance Workspace, Finance task reminders, and tickets; baseline frontend production build passed.
- Intended Finance My Work expansion: add Journals, Reconciliations, and Finance Email Actions to the employee My Work endpoint/dashboard, with schema-safe undefined-table/column fallbacks and dedicated UI lanes.
- Script 1039 DID NOT complete that Finance implementation. The exact run stopped at `MY_WORK_NORMALIZATION_ANCHOR_MISSING`, rolled back the Finance source files, and ended `IMPLEMENTATION_STATUS=FAILED_RESTORED`.
- Therefore do not mark Finance Email Actions / new Finance My Work lanes as delivered by Script 1039. Treat them as pending/requires current-source implementation.
- Important baseline discovered by the later exact-source scan: current `/finance-workspace/my-work` already includes Finance tickets, Month-End tasks, Journals, and Reconciliations in `allItems`, plus an `emailAttention` collection for unacknowledged Finance correspondence.

### Script 1040 - Finance My Work exact-source preflight
- Read-only source preflight only. `PREFLIGHT_STATUS=PASS`.
- Confirmed `/finance-workspace/my-work` exists in `backend/src/routes/financeWorkspace.js`.
- Confirmed current My Work aggregation includes: Finance tickets, Month-End close tasks, Finance Journals, and Finance Reconciliations.
- Confirmed normalized risk/timing flags: overdue, due within 24 hours, due today, due this week, 50%+ elapsed, returned, awaiting review, and evidence required.
- Confirmed separate Finance correspondence `emailAttention` query for assigned, unacknowledged, non-closed email correspondence.
- Confirmed current `FinanceEmployeeDashboard` groups tickets, Month-End, Journals, and Reconciliations and includes an Email Attention section and KPI section.
- No source, database, build, Git, or deployment change was performed by Script 1040.

### Catalogue/ticketing work completed after the 1039 baseline
- Managed Incident Catalogue established as the classification authority for Report an Incident.
- Normal Incident entry is catalogue-first; direct Incident form access without governed managed identity is guarded.
- Legacy Incident Common Issues and editable Incident Category/Sub-category/Item controls were removed from the governed managed Incident flow.
- Major Incident controls remain separate and preserved.
- Incident catalogue reuses the existing Service Request icon library, preferring governed `icon_key` and semantic shared fallbacks.
- Production Service Catalogue outage was traced to missing `workspace_catalogue_items.is_popular`; targeted production migration was applied and the popular managed Service Request query returned seven records.
- Exactly-one-Other rule: every active Incident and Service Request catalogue branch must have exactly one governed `Other` item. Application-side `/workspace-catalogue/ensure-other` governance and a migration are being prepared; database migration execution remains pending until preflight/verification.
- Workspace Catalogue Manager is the authority for adding/removing catalogue items. Ticket forms consume managed catalogue identity rather than inventing classification locally.

### Next controlled work
1. Validate current exactly-one-Other migration against live local catalogue rows without writes.
2. Execute locally only after missing/duplicate/canonical Other rows are known and rollback is available.
3. Run Incident + Service Request catalogue regression, including Other, Major Incident, shared icons, For Myself, For Someone Else, attachment, review, and ticket POST 201.
4. Reconcile Finance My Work current source before any new Finance extension, because Script 1039's attempted patch rolled back and Script 1040 shows the source has already evolved beyond Script 1039's original anchor.
5. Build once after functional validation, then generate curated pre-GitLab evidence. Never use broad `git add .` or `git add -A` in the current dirty repository.
### Tracker/context update safety rule - 2026-11-17
- Future Helpdesk tracker/context scripts must update only canonical live files.
- Never modify historical snapshots under `Folders for scripts backups`, `Batch backups`, `backups`, `reports`, release staging folders, `node_modules`, `dist`, `build`, or `.git`.
- Repository task-tracker updates must preserve existing tracker filenames, sections, and history.

## Script 1036 fixed-v2 checkpoint - 20261121_232854
- Finance-native ticket route /finance-workspace/tickets/:id implemented.
- Non-FIN tickets are redirected to generic /tickets/:id.
- Finance-owned links now use the Finance-native detail route.
- Shared ticket APIs remain authoritative for conversation/history; Finance task-control uses financeWorkspaceApi.
- Final mojibake repair executed only when suspicious score decreased.
- Backup: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\Batch backups\script-1036-fixed-v2-20261121_232854



## Script 1037 fixed-v2 checkpoint - 20261121_234652
- Removed final FinanceWorkspace mojibake using exact semantic context replacements from the forensic report.
- Verified Finance Workspace mojibake score zero and Finance-native ticket detail route/FIN guard.
- Backup: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\Batch backups\script-1037-fixed-v2-20261121_234652


### Script 1056 Fixed V8 - 2026-11-23 09:16:14 +02:00
- Status: validated locally; GitLab-first release flow initiated.
- Validation: backend clean install and unit tests passed; frontend clean install and production build passed.
- Finance rule retained: item score is 50% timeliness and 50% Finance Manager quality after review; late timeliness default is 50; approved cross-department add-back remains configurable up to 50 points.
- Reporting scope retained: daily, weekly, monthly, quarterly, biannual, annual and custom views for access, assigned tickets/duties, projects, expected deliverables, deadlines, evidence, review status and scores.
- Release trace: local commit will be pushed to GitLab first; production will fast-forward to that exact GitLab commit; backups and health validation are mandatory.
- Database migrations executed: No.

## Emergency recovery 1054 - 20261123_094547
- Employee Incident and Service Request submission aligned with governed support-group queue; no mandatory employee-selected agent.
- Operations users retain proposed-assignee workflow.
- Restored workspaceQueryService as required backend dependency in production package.
- Targeted TicketCreate mojibake repaired in change workflow strings.
- Production deployment remains changed-files-only with server backup before overwrite.
- Local backup: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\Batch backups\script-1054-20261123_094547


## Finance Workspace implementation checkpoint - 2026-11-26

### Confirmed current state
- Script 1082 read-only preflight passed. The live workspace membership constraint permits only manager, agent, or viewer.
- Script 1084 comparison passed. lethabotest@gmail.com is an active approved global user in Finance with active Finance responsibility, no IT support-group membership, and no Operations Dashboard entitlement.
- The Operations Dashboard exposure occurred when Finance staff were treated as global agents. Global portal role and workspace membership must remain separate.
- Finance employees must remain global users and receive FIN workspace agent membership only.
- Active Finance managers must remain global users and receive FIN workspace manager membership.
- Finance employees and Finance managers must land automatically in Finance Workspace.
- Finance employees must see Finance My Work, not Helpdesk Operations Dashboard.
- Finance managers must retain Finance review/management scope and may switch to IT Helpdesk Employee View, where they remain ordinary users with no IT operational rights.
- jeffreym@atdalliance.co.za remains platform superadmin with all-workspace governance and a future governed employee-view session function.
- Finance access audit source requires VARCHAR(80); current 30-character width rejects department_position_responsibility.
- SharePoint Graph authentication and drive/root read passed. Employee submission upload/read/delete canary remains required in the implementation validation.
- KPI items and weights remain undeclared. Employee KPI creation/rating controls must remain disabled and KPI self-scoring protection must not be weakened.

### Active implementation batch
- Script 1086 is the current guarded local implementation for Finance employee and manager access.
- The verified live repository root is: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk
- Ignore nested .git metadata beneath Batch backups when locating the live repository.
- Script 1086 has not yet completed. No successful implementation or deployment may be claimed until its report ends FINAL_RESULT=PASS.

### Pending tasks in execution order
1. Complete Script 1086 locally: FIN employee/manager memberships, Finance automatic landing, Finance employee dashboard isolation, manager IT Employee View switch, Finance audit-width repair, nodemon exclusions, frontend build and database verification.
2. Implement Finance submission workflow: SharePoint evidence versioning, submission history, effective-deadline snapshot, provisional Timeliness 50% only when on time, and Awaiting First Review state.
3. Implement first-review workflow: nominated reviewer email and in-app notification with direct authorised submission link, comments, approve/forward, or return for correction.
4. Implement Finance manager final sign-off: direct link, first-review evidence/comments, final approval or return, manager comments, and Quality rating.
5. Implement employee lifecycle communications: assignment, due-date amendment, submission receipt, correction, first approval, manager sign-off required, final outcome, and overdue reminders.
6. Validate role isolation: Finance employee cannot open Operations Dashboard/Ticket Workspace; Finance manager switching to IT uses employee-level access; non-Finance users are denied Finance Workspace; superadmin remains governed.
7. Validate SharePoint upload/read/download/version/history and email links against actual Finance tickets.
8. Update canonical trackers after every batch; do not modify historical backups, release folders, reports, node_modules, dist, build, or .git.
9. Deploy only after local implementation report, frontend build, backend checks, database verification, role tests, SharePoint canary, and email-link tests pass.
10. After deployment verify public Finance employee and manager experiences, production health, audit records, direct links, and rollback readiness.

### Failed/superseded scripts
- Scripts 1074 through 1085 are superseded and must not be rerun.
- Script 1086 supersedes the earlier access implementations.
- Never patch a failed script. Deliver a complete replacement with its paired preflight and regression protections.

### Handoff rule
A new AI model must read these canonical files before proposing changes:
1. docs/ATD_HELPDESK_NEW_CONVERSATION_CONTINUATION_PROMPT.md
2. docs/ATD_HELPDESK_NEW_CONVERSATION_CONTEXT.md
3. docs/ATD_HELPDESK_DEVELOPMENT_TRACKER.md
4. docs/ATD_HELPDESK_MILESTONE_TRACKER.md
Then inspect the latest Script 1086 report in reports/. If Script 1086 has not passed, continue from that exact blocker. Do not repeat completed discovery and do not run a standalone preflight.

## Script 1114 Finance production identity/membership/audit repair - 2026-11-27T09:16:17
- Restored lethabotest@gmail.com Finance department identity and active FIN agent membership while preserving global user role.
- Created governed finance_access_decisions audit table with source VARCHAR(80) and supporting index.
- Verified Finance review schema, Finance manager membership, API health and protected Finance routes; no PM2 restart required.
- PRODUCTION_BACKUP=/home/atddev/atd-helpdesk-backups/finance-1114-20261127071615
- Report: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\reports\ATD_HELPDESK_SCRIPT_1114_FINANCE_IDENTITY_MEMBERSHIP_AUDIT_REPAIR_20261127_091602.txt


## 2026-11-27 - Finance membership and manager authority release gate
- Production Finance membership repair completed: 25 active Finance employees now have active FIN workspace membership.
- Finance employees keep global role user; workspace role uses the existing employee-equivalent role agent without granting Helpdesk Operations access.
- Exact Finance managers aligned by authoritative email: bonganit@atdalliance.co.za, suphapornp@atdalliance.co.za, theeraphat@atdalliance.co.za, and jeffreym@atdalliance.co.za.
- Existing Finance manager ATD-Wilawan Suwannasri was preserved.
- Live Script 1125 gate passed: MISSING_FIN_MEMBERSHIP=0, Finance route present, IT Helpdesk jump present, API healthy.
- Rollback snapshots: /tmp/atd1126_finance_membership_backup_20261127_125240.json and /tmp/atd1127_finance_manager_backup_20261127_125718.json.
- Next: implement review authority/timestamps, countdown/absence/reminders, collaboration/multi-KPI, and email/form/mojibake batches.
