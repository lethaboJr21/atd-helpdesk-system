# ATD Helpdesk Development Tracker

> Living engineering tracker. Update this file at each script completion, milestone transition, failure, repair, validation, server push, and README release.

## Status legend

- `DONE`: implemented and validated at the required level
- `IN PROGRESS`: active development batch
- `READY`: requirements and dependencies are available
- `BLOCKED`: cannot proceed until a recorded condition is resolved
- `DEFERRED`: intentionally scheduled for a later milestone
- `TEST PENDING`: installation passed, consolidated functional validation remains

## Operating rules

1. Continue PowerShell script numbering sequentially under `scripts`.
2. Preserve current working files with exact SHA-256 validation before changes.
3. Create timestamped backups and automatic rollback paths.
4. Keep email disabled and background jobs disabled during controlled development unless a governed email test explicitly requires otherwise.
5. Record participant, activity, and timestamp for ticket changes.
6. Prioritize brief floating activity popups. Show Undo only when a transactional inverse exists.
7. Run one consolidated functional test at the end of each development milestone.
8. Push to the server only after milestone validation.
9. Produce one consolidated milestone report and update the Project README at the milestone boundary.

## Current milestone: Email, SLA, ticket review, routing and interaction

### BATCH B - Finance Workspace Dashboard + Approval/KPI Governance (2026-11-14)

- [x] Database: work-item KPI extension migration (original/effective due dates, evidence_state, review_state, kpi_objective, kpi_period, confidentiality_level)
- [x] Database: KPI scoring tables migration (finance_kpi_objectives, finance_kpi_item_scores, finance_kpi_objective_aggregates, finance_kpi_periods, finance_kpi_score_audit + seed 30/25/15/20/10)
- [x] Database: approval routing/extension/exemption tables migration
- [x] Database: reminder extension migration (assignment_cycle, finance_reminder_thresholds, idempotency index)
- [x] Backend: KPI scoring engine (Timeliness 50%+Quality 50%, objective aggregation, risk projection, recalculation)
- [x] Backend: Approval routing resolver (rule-based, SoD, backup fallback, escalation queue)
- [x] Backend: Extension service (create/decide, effective_due_at update, original_due_at preservation)
- [x] Backend: Review exemption service (grant/revoke with audit)
- [x] Backend: Extended /my-work endpoint (9 metrics, journals/recons, email attention)
- [x] Backend: New endpoints (/my-kpi, /kpi-scores, /kpi-scores/recalculate, /kpi-objectives, /extensions, /extensions/:id/decision, /approvals/:type/:id/exempt, /portfolios/:portfolio/items, /reminders/status)
- [x] Backend: 5 new reminder types (overdue, review_overdue, returned, extension_decision, final_approval) + collision handling
- [x] Frontend: FinanceEmployeeDashboard 9 metrics, journals/recons, email attention lane, My KPI with trend
- [x] Frontend: Shared utilities (financeShared.js) and shared components (SummaryMetricGrid, WorkItemCard)
- [x] Frontend: 10 new API methods
- [x] Tests: Unit tests for KPI scoring, approval routing, extension, exemption, shared utils
- [x] Tests: Integration test skeleton for /my-work, /my-kpi, approval workflow, KPI formula
- [ ] Deployment: Apply migrations in dependency order
- [ ] Deployment: Configure approval routing rules with real directory identities
- [ ] Deployment: Verify KPI objective weights sum to 100%
- [ ] Deployment: Finance employee + manager authenticated regression
- [ ] Deployment: IT/Finance isolation regression
- [ ] Deployment: Controlled production deployment and closeout report

### Milestone objective

Deliver a reviewed ticket-submission flow, configurable priority SLA targets, governed requester/support-group/assignee communication, robust email reply routing, efficient recipient switching, priority-ordered acceptance cards, hover previews, stable list scrolling, and ticket activity popup foundations.

### Work items

- [x] `183` Source and schema checkpoint plus developer tracker
- [x] `184` Ticket review before final submission
- [x] `185` Priority SLA policy, response target, resolution target, persistence and history
- [x] `186` Requester, Support Group and proposed-assignee governed email workflow
- [x] `187` Email replies, reference matching, idempotency and recipient switching
- [x] `188` Pending acceptance cards, priority ordering and hover/focus previews
- [x] `189` Reusable sticky header, scrollable body and sticky footer list shell
- [x] `190` Ticket activity floating popup with participant and timestamp
- [x] `191` Transaction-safe Undo for supported reversible changes
- [ ] `192` Consolidated milestone validation  **NEXT**
- [ ] `193` Server push, consolidated milestone report and comprehensive README update

### Acceptance criteria

- Ticket cannot be submitted until the requester reviews the final summary.
- Ticket reference appears in all lifecycle email subjects.
- Requester, owning Support Group and proposed assignee receive the correct governed message.
- Priority determines visible response and resolution targets.
- Duplicate delivery is prevented through idempotency.
- Email replies attach to the correct ticket and retain sender, recipients and timestamps.
- Recipient changes are audited and never expose internal notes.
- Pending acceptance is ordered by priority and SLA urgency.
- Hover/focus preview shows a short description and a Read More action.
- List headers and footers remain visible while rows scroll.
- Ticket changes produce a brief floating popup and persistent activity record.
- Undo is offered only for safe, supported actions.

## Completed foundation

- Assignment and access schema foundation
- Guided routing and assignment proposal API
- Assignment acceptance controls
- Actionable notifications
- Outside-group redirection
- Collaborators and email participants
- Access requests and approvals
- Temporary entitlement activation, expiry and revocation
- Duplicate request conflict handling
- Entity-aware notification actions
- Eligibility-aware feature access
- Five-second access-workflow popups

## Deferred product integrations

- Expanded notification-history explorer
- Dedicated detailed Activity page
- Warehouse-management integration
- Health and Safety responder directory
- Department-specific workflow adapters
- Frontend bundle code splitting and manual chunks

## Risks and watch items

- Email governance must prevent accidental external delivery during development.
- SLA policy should be configurable rather than permanently hard-coded.
- IT operational eligibility requires reliable department data.
- Ticket visibility must remain requester, participant, assignment and authorised-scope based.
- Existing email-to-ticket processing and Microsoft Graph integration must remain intact.
- Undo must never delete original audit history.

## Decision log

- Floating change popup is higher priority than the expanded notification-history explorer.
- Notification history and Activity explorer remain separate concepts.
- Operations Dashboard is IT operational access, not a universal employee feature.
- Helpdesk self-service remains available across departments with strict ticket visibility.
- README updates occur at milestone boundaries, not after each individual script.

<!-- SCRIPT-207-DEPLOYMENT-START -->
## Production deployment closure: 2026-09-01

### Outcome
- Release atd-helpdesk-runtime-release-20260901-090118 is active in production.
- Release archive SHA-256: 9A6763700789CED96E030DB526CF10113B95DD938D84F79A600E274C82AD1E5D.
- Backend, frontend and PostgreSQL health checks passed.
- Consolidated production validation completed with 18 passes, 10 warnings and 0 failures.
- PM2 application atd-helpdesk-api remained online on validated PID 1164117.
- Public frontend checksum: 578A308C6FEF2BED7D7028862F348D136E0A1FF5F7C1D6FD586DC615C3E9F90D.
- Verified rollback backup: /home/atdadmin/atd-helpdesk-backups/pre-release-20260901-091236.

### Committed additive migrations
- 2026-08-assignment-acceptance-access-foundation.sql
- 2026-08-email-replies-and-recipient-switching.sql
- 2026-08-first-login-onboarding.sql
- 2026-08-guided-routing-foundation.sql
- 2026-08-priority-sla-policy.sql
- 2026-08-terms-governance.sql
- 191_transaction_safe_undo.sql

### Excluded migration
- 2026-08-corrected-guided-request-routing.sql was not executed because it changes support-group and routing-rule data.
- Manual business-data review is required before any future execution.

### Next milestone: Post-deployment functional validation and hardening
- Script 208 is the next scheduled script.
- Run one consolidated role-based functional validation across employee, agent, manager, approver and administrator workflows.
- Do not create synthetic production tickets or trigger live email without a governed test plan.
- Do not reload Apache until apache2ctl configtest passes.
- Preserve the verified rollback set until the next successful production milestone supersedes it.

### Open work
- Controlled production lifecycle-email delivery validation
- Production inbound email-to-ticket validation
- Bedliner DNS resolution for atd-sql01
- Apache SSL private-key repair and successful configtest
- PM2 reboot-persistence repair
- Business-data review of the excluded corrected guided-routing migration
- Consolidated role-based functional milestone testing
- Syspro service-specific response SLA resolver
- Base-less route redirect compatibility
- Survey and background-job validation
- Expanded Undo coverage beyond status and priority
- Dashboard customisation, named layout templates, themes and universal UX batch
- Frontend bundle code splitting and chunk optimisation
<!-- SCRIPT-207-DEPLOYMENT-END -->

### Current milestone: Post-deployment functional validation and hardening

- Status: READY
- Next script: 208
- Objective: run one consolidated role-based functional validation without synthetic production tickets or ungoverned email delivery.

<!-- SCRIPT-423-ROADMAP-BEGIN -->
## Progress checkpoint: 9 September 2026

### Completed and deployed
- Governed bulk Modify, Archive, and Superadministrator-only permanent Delete foundation.
- Cross-page ticket selection in Ticket Workspace and Dashboard Priority Queue.
- Governed page sizes: 25, 50, 100, 250, and 500.
- Manager and Superadministrator archive-rule foundation, disabled by default.
- Company Communications migrations and production deployment completed.
- Shared release, rollback evidence, and two-account deployment model established.

### Completed locally, pending milestone validation and deployment
- Responsive Kanban and floating bulk-toolbar standardisation.
- Governed bulk user role dialog with mandatory change reason.
- Role-aware Employee, Agent, Operator, Manager, Administrator, and Superadministrator experience contracts.
- Ticket Monitor requester identity using Opened by and Requested for.
- Ticket lifecycle foundation: Unassigned, Awaiting Acceptance, Open, Investigating, Pending, Waiting Approval, Resolved, and Escalated.
- Inline Monitor assignment proposal and Assign to me controls.
- Seven-day Resolved-to-Closed automation foundation.
- Agent archive limited to owned tickets; Agent deletion prohibited; permanent deletion restricted to Superadministrator.
- Role-scoped sidebar and Ticket Workspace preview controls.
- Advanced ticket-filter SQL placeholder corrections and saved-view synchronisation foundation.

### Current next batch: notifications, archive, and activity
1. Persistent actionable notification list with Accept, Action, and Mark as read.
2. Strong unread versus read presentation while preserving actions after read state changes.
3. Dedicated Active and Archived ticket lifecycle tables with governed restore.
4. Improved ticket activity and audit trail design with actor, timestamp, old value, new value, reason, and source.

### Urgent onboarding and HR Workspace additions
- Avatar upload is optional during onboarding. Initials remain the fallback when no image is supplied.
- Users may skip avatar upload and add or change the avatar later from the account profile.
- Legal and onboarding documents must support company-authored and company-approved policies, drafts, versions, owners, effective dates, acknowledgements, and attachments.
- Add an HR-focused Workspace module for onboarding policy administration.
- Initial HR policy families include asset-registry and asset-custody policies, acceptable-use policies, information-security policies, privacy and confidentiality policies, onboarding forms, declarations, and employee acknowledgements.
- Policies must support Draft, Under Review, Approved, Published, Superseded, and Archived lifecycle states.
- Published policies may require employee acknowledgement with timestamp and policy-version evidence.
- Department Workspace access remains least-privilege and governed by membership, collaborator status, explicit grant, and management scope.

### Scheduled Department Workspace sequence
1. Department Workspace shell, selector, navigation, responsive layout, and role-aware entry.
2. Department membership, Manager scope, Agent service scope, collaborators, and eligibility controls.
3. Department ticket queues, requester and department identity, SLA, escalations, and today-first workload.
4. HR onboarding and policy module, policy acknowledgements, communications, knowledge, activity, saved layouts, and reporting.

### Deferred but compulsory batches
- Dashboard differentiation for Employee, Agent, Manager, Administrator, and Superadministrator.
- Saved personal and shared ticket views with advanced filters and sorting.
- Live Ticket Workspace and Monitor refresh without clearing drafts, filters, selection, dialogs, or previews.
- Agent task views: opened, investigating, assigned to me, awaiting acceptance, closed today, this week, and this month.
- Requester avatar hover profile and governed Microsoft presence when a verified presence service is connected.
- Collaborators, employee CC picker, support-group alerts, Teams ticket chat, and complete conversation capture.
- Resolved and Closed surveys, attachment previews, full-screen files, and expanded audit history.
- Named dashboard layout templates integrated with themes and Light/Dark mode.

### Milestone control
- Continue implementation in coherent four-function groups.
- Defer broad testing until the current milestone implementation boundary is complete.
- Then run one comprehensive milestone test, commit and push, create an exact release, deploy, and produce one consolidated report.
<!-- SCRIPT-423-ROADMAP-END -->

<!-- ATD-SCRIPT-430-PRIORITY-START -->
## Current priority checkpoint

Updated: 2026-09-10 20:56:56
Branch: $branch
Baseline: $head

### Priority batch now being prepared

1. **Manager approval for catalogue requests**
   - Every Service Catalogue and Asset Catalogue request requires the requester's Manager approval before operational fulfilment, except Printer Access, Password Reset, and Wi-Fi Access.
   - Catalogue cards must visibly state **Manager approval required** before submission.
   - Submission creates a pending approval request and ticket lifecycle record without presenting the item as approved work.
   - The Manager receives persistent actionable notification and governed email where enabled.
   - Approval advances the request to operational triage; rejection records the reason and informs the requester.
   - If no verified Manager is available, route to a governed fallback approval queue rather than bypass approval.

2. **Today-first Ticket Monitor**
   - Default to tickets logged today and load new tickets into the Monitor.
   - Filters: Department and Agent.
   - Date windows: Today, Yesterday, 1 day, 2-7 days, and 30 days.
   - Add a clear Show/Hide tickets older than 7 days control.
   - Preserve current filters during refresh and assignment actions.
   - Show created time, requester, department, lifecycle state, assignee, priority, and SLA.

3. **Employee transition communication**
   - Prepare a whole-company reminder directing employees to the new ATD Helpdesk.
   - Include or attach a manual guide covering ticket logging.
   - Record that access to the previous Helpdesk has been revoked by the responsible HOD.
   - Do not send automatically until audience preview, content review, and governed send confirmation are completed.

4. **Tracker continuity and milestone scan**
   - Maintain development tracker, capability register, and governance handoff.
   - Validate implementation claims against code.
   - Schedule a complete project capability scan and README reconciliation at the milestone boundary.

### Existing current batch retained

- Persistent actionable notifications and explicit read/unread controls.
- Current-ticket Active, Archived, and Pending Deletion views.
- Seven-day archive grace-period listing and governed restore/delete controls.
- Structured searchable activity table.
- Requester and Department-first ticket presentation.
- Replace Send labels with Reply, Reply and Resolve, Reply and Close, and Add Internal Note.

### Status

- Catalogue approval and today-first monitor: **SOURCE VALIDATION IN PROGRESS**
- Notifications/archive/activity/reply terminology: **PENDING DIRECT IMPLEMENTATION**
- Full project scan: **SCHEDULED AT MILESTONE BOUNDARY**
<!-- ATD-SCRIPT-430-PRIORITY-END -->

<!-- ATD-SCRIPT-431-LIFECYCLE-ESCALATION-START -->
## Current lifecycle, escalation, monitor and terminology checkpoint

Updated: 2026-09-10 22:30:32
Branch: feature/launch-communications-queue-compatibility
Baseline: 120e91a47d584ac25a250ee18689389624e2fa7c

### Active four-function implementation group

1. **Today-first Ticket Monitor and minimizable lifecycle columns**
   - Default range: Today.
   - Ranges: Yesterday, 1 through 7 days, and 30 days.
   - Filters: Department, Agent, support group, priority and lifecycle state.
   - Show or hide tickets older than seven days.
   - Column order: Unassigned; Awaiting Manager Approval; Awaiting Agent Acceptance; Open; Investigating; Pending; Waiting Approval; Escalated; Resolved; Closed.
   - Resolved and Closed collapsed by default; users can minimize individual columns and restore the default layout.

2. **Governed escalation workflow**
   - Escalate to verified Manager or Head of Department.
   - Mandatory reason, urgency and required action.
   - Fallback to Escalation Governance Queue when no verified recipient exists.
   - States: Requested, Awaiting Acknowledgement, Acknowledged, Returned, Resolved and Cancelled.
   - Persistent actionable notifications retain actions after read state changes.

3. **Catalogue Manager approval**
   - Manager approval required for Service Catalogue and Asset Catalogue requests.
   - Exceptions: Printer Access, Password Reset and Wi-Fi Access.
   - Catalogue items must display approval requirements before submission.
   - Approval-required requests remain outside operational fulfilment until approved.

4. **Terminology and conversation actions**
   - Open Case becomes View Ticket throughout the portal.
   - Send becomes Reply.
   - Send and Resolve becomes Reply and Resolve.
   - Send and Close becomes Reply and Close.
   - Internal-note submission becomes Add Internal Note.

### Archive rule retained

Archived tickets appear under Pending Deletion during a seven-day grace period. The grace period does not trigger automatic permanent deletion. Only a Superadministrator can perform governed permanent deletion after the grace period, with reason, typed confirmation and audit evidence.

### Validation boundary

Before implementation, validate exact current source locations for monitor columns, escalation routes, conversation buttons, notification actions and all Open Case labels. At the milestone boundary, run the full project capability scan, reconcile the tracker and README, then perform one comprehensive test.
<!-- ATD-SCRIPT-431-LIFECYCLE-ESCALATION-END -->

<!-- ATD-SCRIPT-435-PREDEPLOYMENT-START -->
## Script 435 predeployment local implementation
- Latest-created ticket ordering remains the default when no explicit alternative sort is selected.
- Critical, Department and Requestor filters are visible in the Ticket Workspace and Dashboard Priority Queue.
- Selected-ticket actions use a portal-level fixed overlay above headers and pagination, with responsive wrapping.
- Company announcement attachments, themed email templates and compulsory onboarding validation remain in the same predeployment milestone but are not claimed complete by this script.
- Next gate: frontend production build, filter validation, overlay validation, onboarding/communications implementation, then curated deployment.
<!-- ATD-SCRIPT-435-PREDEPLOYMENT-END -->

<!-- ATD-SCRIPT-438-COMMUNICATIONS-START -->
## Company Communications and ticket attachment predeployment scope

Updated: 2026-09-11 14:28:10

### Current direct implementation group

1. **Governed whole-company confirmation**
   - Replace browser confirm and ISO date prompts with in-app dialogs.
   - Whole-company send actions: Edit Communication, Cancel, Approve and Send.
   - Whole-company schedule actions: Edit Communication, Cancel, Approve and Schedule.
   - Require exact recipient preview, final template preview, attachment validation and typed SEND TO ALL EMPLOYEES confirmation.
   - Preserve all draft fields when returning to edit.

2. **Communication workspace UX**
   - Tabs: Create Announcement, Drafts, Scheduled, Published and Sent, Archived.
   - Audience combinations: whole company, departments, positions, specific people, support groups, Workspace members and external recipients.
   - Group people by Department and show avatar or initials, position, email and account status.
   - Add governed exclusions and exact audience preview.

3. **Dashboard announcements and conversations**
   - Publish eligible announcements to Employee, Agent, Manager, Administration and Department Workspace dashboards.
   - Whole-company announcements display to all eligible active employees.
   - Optional announcement conversations with comments, publisher responses, timestamps and moderation audit.
   - Read state must not remove announcement actions or content.

4. **Tracking, attachments, templates and lifecycle**
   - Detailed recipient delivery history showing recipient, Department, position, provider, status, time and failure or skip reason.
   - Announcement document attachments with drag and drop and Browse using the same validated handler.
   - Reusable themed HTML and plain-text templates.
   - Draft delete, sent or published archive, and Superadministrator-only governed permanent deletion.

5. **Ticket attachment inline viewing**
   - Image attachments open inside the ticket in an accessible full-screen preview instead of forcing a device download.
   - Supported initial preview formats: PNG, JPEG and WebP. PDF uses the browser viewer when safe and supported.
   - Keep an explicit Download action beside Open Preview.
   - Browse selection and drag and drop use the same attachment-state handler.
   - Preview includes filename, type, size, uploaded by, uploaded time, previous and next, zoom, close and download controls.
   - Unsupported files retain secure governed download only.
   - Attachment access continues to use authenticated ticket authorization and never exposes storage paths.

### Deployment blockers retained

- Compulsory employee onboarding validation and optional avatar step.
- Active, Archived and Pending Deletion current-ticket views.
- Announcement attachment Browse defect.
- Company Communications dialogs, templates, delivery detail and dashboard placement.
- Ticket image and PDF inline preview and Browse attachment selection correction.
- Consolidated frontend build, backend checks, tracker reconciliation and curated deployment.
<!-- ATD-SCRIPT-438-COMMUNICATIONS-END -->

<!-- ATD-SCRIPT-441-START -->
## Script 441 ticket attachment preview

- Ticket image and PDF inline preview: IMPLEMENTED LOCALLY.
- Explicit Download action: RETAINED.
- Browse selected-file handler and same-file reselection reset: IMPLEMENTED LOCALLY.
- Backend preview authorization and inline content disposition: IMPLEMENTED LOCALLY.
- Frontend build and milestone validation: PENDING.
<!-- ATD-SCRIPT-441-END -->

<!-- ATD-SCRIPT-446-START -->
## Script 446 Company Communications

- Governed Approve and Send / Approve and Schedule dialogs without typed phrases: IMPLEMENTED LOCALLY.
- Edit Communication and Cancel actions: IMPLEMENTED LOCALLY.
- Branded message templates and message-first editor: IMPLEMENTED LOCALLY.
- Draft, Scheduled, Published and Sent, and Archived tabs: IMPLEMENTED LOCALLY.
- Recipient-level delivery history: IMPLEMENTED LOCALLY.
- Managers, HODs, positions, support groups and combined audiences: PENDING.
- Announcement attachments, Dashboard publication and conversations: PENDING.
- Frontend build and milestone validation: PENDING.
<!-- ATD-SCRIPT-446-END -->

<!-- ATD-SCRIPT-447-COMMUNICATIONS-START -->
## Current batch: announcement attachments, audiences, dashboard publication and conversations

Updated: 2026-09-12 08:43:07

### Implemented locally before this batch
- Governed Approve and Send / Approve and Schedule dialogs without typed phrases.
- Edit Communication and Cancel actions.
- Branded communication templates and message-first editor.
- Draft, Scheduled, Published and Sent, and Archived tabs.
- Recipient-level delivery history foundation.

### Current four-function batch
1. Announcement attachments with drag and drop, Browse, shared validation, secure storage and governed download.
2. Expanded audiences for whole company, Departments, Managers, HODs, positions, specific people, support groups, Workspace members, external recipients and exclusions.
3. Dashboard publication for eligible Employee, Agent, Manager and Administration audiences.
4. Optional announcement conversations with audience-restricted comments, publisher responses, timestamps, moderation and audit evidence.

### Required governance
- Whole-company and targeted sends require the in-app confirmation popup.
- Confirmation actions are Approve and Send or Approve and Schedule, Edit Communication, and Cancel.
- No typed confirmation phrase and no native browser prompt.
- Published communications remain traceable by campaign and recipient.
- Sent communications should normally be archived, not hard-deleted.
- Permanent deletion remains Superadministrator-only, reasoned and audited.
- Dashboard visibility must use the resolved audience and must not expose restricted announcements.
- Browse and drag-and-drop attachments must use the same processing path.
- No live communication may be sent during implementation or validation.

### Still blocking deployment after this batch
- Compulsory onboarding validation and optional avatar.
- Active, Archived and Pending Deletion ticket lifecycle.
- Structured activity and persistent notification completion.
- Consolidated frontend build, backend validation, curated commit and exact deployment.
<!-- ATD-SCRIPT-447-COMMUNICATIONS-END -->

<!-- ATD-SCRIPT-449-TICKET-INSIGHTS-START -->
## Ticket Workspace Insights and Weekly Operational Report

Updated: 2026-09-12 09:09:24
Status: SCHEDULED AFTER CURRENT PREDEPLOYMENT BLOCKERS

### Ticket Workspace use of available space
- Replace unused right-side space with a selectable insight rail.
- Available views: Ticket Preview, Ticket Statistics, and Hide Panel.
- Ticket Preview remains closeable and reopenable from the View controls.
- Ticket Statistics must not reduce or hide the ticket list on smaller screens.
- Statistics panel becomes a drawer or stacked section on narrow devices.

### Ticket Statistics
- Total, opened, unassigned, awaiting acceptance, investigating, pending, escalated, resolved and closed tickets.
- Critical, overdue and SLA-at-risk totals.
- Tickets by Department, requester, support group and assigned Agent.
- Agent with highest and lowest assigned-ticket volume, with minimum-volume safeguards.
- First-response duration, average response duration and resolution duration by Agent and team.
- Most common ticket opening hour and weekday.
- Most frequent governed keywords and service topics, including Syspro, Wi-Fi, QMuzik and scanners.
- Flag unusual weekly increases without exposing confidential ticket body text.
- Statistics refresh from server data and respect the signed-in user's authorised scope.

### Portal usage metrics
- Unique person accounts that successfully sign in per day, week and month.
- Exclude failed attempts, service accounts, automation accounts and duplicate sessions.
- Report active portal users by role and Department where authorised.
- Requires verified authentication-event storage before implementation can be marked complete.

### Weekly report
- Generate every Monday at 08:00 Africa/Johannesburg for the completed previous Monday-to-Sunday period.
- Store the report in the Helpdesk and make it available on demand to authorised Agents and their Managers.
- Include assignment volume, first response, response duration, resolution duration, SLA state, opening patterns, portal usage and top recurring terms.
- Show highest and lowest ticket volume with context so small or inactive teams are not misleadingly ranked.
- Record generation timestamp, reporting window, data scope and requester.
- Support downloadable UTF-8 text initially, with PDF/Excel export scheduled after the core report is verified.
- Attach the approved summary to the ATD Helpdesk Weekly Report email only after email delivery validation.

### Sequencing
1. Finish current predeployment blockers: Administration layout, communications expansion, onboarding, archive lifecycle, activity and notification completion.
2. Run consolidated milestone validation and deploy.
3. Implement Email-to-Ticket repair batch.
4. Implement Ticket Workspace Insights and verified usage instrumentation.
5. Implement Monday weekly report generation and governed Agent/Manager access.
6. Reconcile capability register, README and milestone report.
<!-- ATD-SCRIPT-449-TICKET-INSIGHTS-END -->

<!-- ATD-SCRIPT-451-RIGHT-PANEL-START -->
## Ticket Workspace adaptive right panel

Updated: 2026-09-12 09:17:26
Status: SCHEDULED WITH TICKET WORKSPACE INSIGHTS BATCH

### Default layout contract
- When Ticket Preview, Ticket Statistics, or another right-side panel is closed, minimized, or unpinned, the ticket list and Kanban board must automatically expand to use the full available workspace width.
- No blank reserved column may remain when no right panel is visible.
- List headers, ticket rows, Kanban columns, pagination, filters, and the selected-ticket overlay must recalculate against the expanded width.
- Closing a panel must not clear the selected ticket, filters, typed drafts, selections, or scroll position.

### Right-side panel controls
- Add a portal View or Layout menu inspired by desktop workbench layout controls.
- Menu options: Show Ticket Preview, Show Ticket Statistics, Pin Right Panel, Unpin Right Panel, Close Right Panel, and Restore Default Layout.
- Only one primary right panel is required initially; later support for tabbed panels may be added.
- An unpinned panel opens as a temporary overlay/drawer and closes after explicit close, Escape, or safe focus departure. It must remain open while hovered or keyboard-focused.
- A pinned panel remains beside the ticket list and uses a user-adjustable width within governed minimum and maximum limits.
- Persist the user's panel mode, selected panel, pinned state, visibility, and width locally.

### Responsive behaviour
- Wide desktop: pinned side-by-side panel with resizable divider.
- Medium desktop/tablet: overlay drawer by default, with optional pin only where minimum list width remains usable.
- Small screen: full-width modal/drawer; ticket list remains full width when closed.
- The ticket list must never be omitted or made unusably narrow.

### Statistics panel
- Ticket Statistics uses the same right-panel host as Ticket Preview.
- Statistics respect current user authorization and should not expose tickets outside permitted scope.
- Weekly statistics and Monday reports remain scheduled after the current deployment and Email-to-Ticket repair.
<!-- ATD-SCRIPT-451-RIGHT-PANEL-END -->

<!-- ATD-SCRIPT-450-V2-START -->
## Script 450 V2 Administration layout

- Full-width responsive Administration settings workspace: IMPLEMENTED LOCALLY.
- Single internal content scrollbar with sticky modal header: IMPLEMENTED LOCALLY.
- Compact responsive Administration cards and communication editor: IMPLEMENTED LOCALLY.
- Sticky communication draft actions: IMPLEMENTED LOCALLY.
- Frontend build and milestone validation: PENDING.
<!-- ATD-SCRIPT-450-V2-END -->

<!-- ATD-SCRIPT-453-CONTEXT-AUDIENCE-START -->
## Script 453 portable context and audience exceptions

- Portable new-conversation context file: CREATED.
- Checkbox-based inclusive audiences and Other options exclusions: CONTRACT RECORDED.
- Whole company except Managers or HODs: REQUIRED.
- Specific employees and additional emails: REQUIRED.
- Server-authoritative resolution, deduplication, preview and recipient evidence: REQUIRED.
- Session handling and security hardening: SCHEDULED FOR RECOMMENDATION-LED REVIEW.
- Application, database, email, Git and deployment changes: NONE.
<!-- ATD-SCRIPT-453-CONTEXT-AUDIENCE-END -->

<!-- ATD-SCRIPT-454-V2-START -->
## Script 454 V2 canonical communication audience foundation

- Additive `audience_definition` migration: IMPLEMENTED LOCALLY, NOT EXECUTED.
- Replacement `audience_type` constraint allowing `all`, `departments`, `users`, and `combined`: IMPLEMENTED LOCALLY.
- Backward-compatible normalization of the existing audience types: IMPLEMENTED LOCALLY.
- Canonical combined include/exclude audience resolver: IMPLEMENTED LOCALLY.
- Include Departments, roles, positions, specific people, Support Groups, and Workspace members: IMPLEMENTED LOCALLY.
- Exclude Departments, roles, positions, specific people, Support Groups, and Workspace members: IMPLEMENTED LOCALLY.
- Deduplication of internal and external recipients by normalized email: IMPLEMENTED LOCALLY.
- HOD selection and exclusion fail closed until an authoritative HOD entitlement exists: IMPLEMENTED LOCALLY.
- External-recipient permission, confirmation UI, recipient-snapshot persistence, and delivery integration: PENDING.
- Checkbox audience editor, attachments, Dashboard announcements, and conversations: PENDING SEPARATE BATCHES.
- Migration execution, frontend build, database compatibility validation, email testing, and deployment: PENDING.
<!-- ATD-SCRIPT-454-V2-END -->

<!-- ATD-SCRIPT-456-START -->
## Script 456 checkbox audience and preview evidence

- Checkbox audience editor and Department-grouped people: IMPLEMENTED LOCALLY.
- Combined inclusions and Other options exclusions: IMPLEMENTED LOCALLY.
- Normalized audience definition persistence: IMPLEMENTED LOCALLY, migration pending.
- Server preview evidence with internal/external counts: IMPLEMENTED LOCALLY.
- HOD controls fail closed until authoritative mapping exists.
- External recipients restricted to Superadministrator.
- Build, migration execution, functional testing and deployment: PENDING.
<!-- ATD-SCRIPT-456-END -->

<!-- ATD-SCRIPT-457-DEVELOPMENT-MODE-START -->
## Development and GitHub-only working mode

Updated: 2026-09-12 11:50:28
Branch: feature/launch-communications-queue-compatibility
Baseline HEAD: 120e91a47d584ac25a250ee18689389624e2fa7c

### Current operating boundary

- Local development, exact-source validation, backups, rollback, tracker updates, backend syntax checks, and milestone frontend builds are allowed.
- Curated commits may be pushed to the github remote only during the current development window.
- Production SSH, migration execution, PM2 restart, Apache changes, live release activation, and live communication sending are deferred until the later server window on 12 September 2026.
- Additive migration files may be created but must not be executed during this development window.

### Current four-function batch

1. Announcement attachment persistence and metadata.
2. Shared Browse and drag-and-drop attachment handling.
3. Secure attachment listing, removal, and download authorization.
4. SMTP and Microsoft Graph attachment delivery compatibility, without sending live mail during validation.

### Required immediate corrections

- Audience changes must invalidate stale recipient-preview evidence.
- Replace visible encoding artifacts such as A-circumflex-middle-dot with a plain | separator.
- Attachment confirmation must show filename, size, type, and count.
- No physical storage path may be exposed to the frontend.

### Current completion state

- Canonical combined audience resolver: IMPLEMENTED LOCALLY.
- Checkbox audience editor and exclusions: IMPLEMENTED LOCALLY.
- Canonical audience persistence and preview evidence: IMPLEMENTED LOCALLY.
- Audience migration execution: PENDING SERVER WINDOW.
- Announcement attachments and email provider integration: CURRENT BATCH.
- Dashboard announcement placement and conversations: PENDING.
- Compulsory onboarding and optional avatar: PENDING.
- Active, Archived, and Pending Deletion ticket views: PENDING.
- Consolidated milestone validation and GitHub push: PENDING.
<!-- ATD-SCRIPT-457-DEVELOPMENT-MODE-END -->

<!-- ATD-SCRIPT-458-START -->
## Script 458 announcement attachments and provider compatibility

- Announcement attachment persistence, metadata, confined storage and secure download: IMPLEMENTED LOCALLY, migration pending.
- Shared Browse and drag/drop attachment picker: IMPLEMENTED LOCALLY.
- Draft attachment removal with audit evidence: IMPLEMENTED LOCALLY.
- SMTP and Microsoft Graph attachment contracts: IMPLEMENTED LOCALLY, live delivery not tested.
- Audience changes invalidate stale preview evidence: IMPLEMENTED LOCALLY.
- Frontend build, migration execution, functional testing and deployment: PENDING.
<!-- ATD-SCRIPT-458-END -->

<!-- ATD-SCRIPT-459-START -->
## Script 459 dashboard announcements and conversations checkpoint

Updated: 2026-09-12 11:57:30
Branch: feature/launch-communications-queue-compatibility
Baseline HEAD: 120e91a47d584ac25a250ee18689389624e2fa7c

### Current four-function batch

1. Audience-restricted announcements on Employee, Agent, Manager, and Administration dashboards.
2. Persistent read state with a strong New indicator while keeping read announcements available.
3. Optional announcement conversations with employee comments, publisher replies, timestamps, avatars or initials, and edited state.
4. Governed moderation with audience checks and audit evidence.

### Required rules

- Whole-company announcements are visible to every eligible active internal recipient.
- Restricted announcements are visible only to resolved recipients and authorised communication administrators.
- Read state does not delete or hide an announcement.
- Attachment access uses the same audience evidence as announcement visibility.
- Comments are available only when allow-comments is enabled and the person remains in the audience.
- Moderation never silently removes audit history.
- Development mode remains local implementation and curated GitHub push only.
- Migration execution, live communication sending, production SSH, restart, and deployment remain deferred.

### Current status

- Announcement attachment persistence and provider compatibility: IMPLEMENTED LOCALLY, migration pending.
- Dashboard publication, read state, conversations, and moderation: CURRENT BATCH.
- Compulsory onboarding and optional avatar: PENDING.
- Active, Archived, and Pending Deletion ticket lifecycle: PENDING.
- Milestone build, curated commit, and GitHub push: PENDING.
<!-- ATD-SCRIPT-459-END -->

<!-- ATD-SCRIPT-460-START -->
## Script 460 dashboard announcements and conversations

- Audience-restricted Employee, Agent, Manager and Administration dashboard announcements: IMPLEMENTED LOCALLY.
- Persistent New and read state: IMPLEMENTED LOCALLY, migration pending.
- Optional audience-restricted announcement conversations: IMPLEMENTED LOCALLY, migration pending.
- Superadministrator and Administrator comment moderation with audit evidence: IMPLEMENTED LOCALLY.
- Manager scoped moderation remains pending authoritative Department or Workspace scope.
- Frontend build, migration execution, functional testing and deployment: PENDING.
<!-- ATD-SCRIPT-460-END -->

<!-- ATD-SCRIPT-464-ONBOARDING-START -->
## Compulsory onboarding, optional avatar, and render-warning batch

Updated: 2026-09-12 13:24:27
Branch: feature/launch-communications-queue-compatibility
Baseline HEAD: 120e91a47d584ac25a250ee18689389624e2fa7c

### Current four-function batch

1. Validate and enforce compulsory onboarding for incomplete active employee person accounts.
2. Add an optional onboarding avatar step with Add Picture and Skip for Now; initials remain the fallback.
3. Exclude archived, deactivated, external, generic, service, automation, and other non-person accounts from employee onboarding enforcement.
4. Correct the React state-update-during-render warning involving AdminUniversalHeader and AccountMenu before the milestone frontend build.

### Required validation

- Direct protected URLs must not bypass compulsory onboarding.
- Completed employees must not be redirected again for the same onboarding version.
- Onboarding completion must remain versioned, timestamped, and audited.
- Mandatory acknowledgements remain compulsory; avatar upload remains optional.
- Avatar upload, replace, crop, remove, and initials fallback must preserve existing profile-media authorization.
- No component may update AccountMenu state while AdminUniversalHeader is rendering.
- Full frontend build and functional onboarding test remain milestone gates.

### Operating boundary

- Development and curated GitHub push only.
- No migration execution, live communication send, server connection, restart, or production deployment in this batch.
<!-- ATD-SCRIPT-464-ONBOARDING-END -->

<!-- ATD-SCRIPT-467-START -->
## Script 467 onboarding, avatar, and render-safety implementation

- Server-authoritative onboarding eligibility and exemption reason: IMPLEMENTED LOCALLY.
- Compulsory onboarding remains controlled by onboarding.enforcement_mode; activation is PENDING deployment validation.
- Optional Picture step with Add Picture and Skip for Now: IMPLEMENTED LOCALLY.
- Existing secure crop/upload/remove avatar pipeline reused: VERIFIED AND RETAINED.
- Non-person and inactive-account onboarding exclusions: IMPLEMENTED LOCALLY.
- AccountMenu/AdminUniversalHeader appearance render-warning cause corrected in useAppearance: IMPLEMENTED LOCALLY.
- Native avatar removal confirmation replaced with an in-editor confirmation: IMPLEMENTED LOCALLY.
- Frontend production build and functional onboarding validation: PENDING milestone gate.
<!-- ATD-SCRIPT-467-END -->

<!-- ATD-SCRIPT-469-TICKET-ARCHIVE-START -->
## Current ticket archive lifecycle batch

Updated: 2026-09-12 14:12:35
Branch: feature/launch-communications-queue-compatibility
Baseline HEAD: 120e91a47d584ac25a250ee18689389624e2fa7c

### Current four-function group

1. Dedicated Active Tickets, Archived Tickets, and Pending Deletion views.
2. Seven-day archive grace-period calculation and visible countdown without automatic permanent deletion.
3. Governed restore and permanent-deletion controls with reasons, typed high-impact confirmation, and audit evidence.
4. Requester-first and Department-first archive presentation with structured archive activity.

### Lifecycle rules

- Active tickets have no archive timestamp.
- Archived tickets remain recoverable and searchable.
- Pending Deletion means an archived ticket is within or beyond the seven-day governance window; it does not mean automatic deletion will occur.
- After seven days, a ticket remains listed until an authorised Superadministrator deliberately performs governed permanent deletion.
- Agents may archive only tickets assigned to their own account and may not restore or permanently delete tickets.
- Managers may restore tickets only within proven governed scope.
- Superadministrators may restore and perform governed permanent deletion.
- Permanent deletion requires a reason, an impact warning, typed confirmation, and retained audit or tombstone evidence.
- Freshservice import history must remain separate from the current-ticket archive lifecycle.

### Required presentation

- Ticket reference and subject.
- Requester avatar or initials and requester name.
- Department.
- Previous status and current archive state.
- Priority.
- Archived by, archive date, archive reason, grace-period expiry, and time remaining.
- View Ticket, View Activity, Restore, and governed Delete actions according to authority.

### Operating boundary

- Development and curated GitHub push only.
- This checkpoint does not modify application source, execute migrations, send communications, or contact the server.
<!-- ATD-SCRIPT-469-TICKET-ARCHIVE-END -->
<!-- ATD-SCRIPT-470-REOPEN-STATISTICS-START -->
## Resolved-ticket recurrence and reopen statistics

- A requester must be able to reopen the same ticket when a previously resolved issue reappears, provided the ticket has not entered a protected permanent-deletion state.
- Reopening must preserve the original resolution, closure and assignment history rather than replacing prior lifecycle evidence.
- The requester must provide a recurrence reason when reopening; the action, requester, timestamp and prior status must be written to ticket activity.
- Reopening a Resolved or Closed ticket must return it to the governed active queue, clear only the current resolved/closed state timestamps where required by the existing queue model, and retain historical resolution-cycle evidence separately.
- Every reopen event must increment a server-maintained reopen count and record the latest reopened timestamp and actor.
- Ticket statistics and printable manager reporting must include reopened-ticket count, reopen rate, repeat-issue count, time from resolution to recurrence, service category, support group and anonymised recurrence themes where appropriate.
- Reopened tickets must remain visible as repeat issues in agent and manager views without exposing requester-identifying survey commentary in aggregate reports.
- Reopening must not create a duplicate ticket unless a governed split or linked-child workflow is deliberately used later.
- Closure notifications and surveys must account for reopen state so that duplicate surveys are not requested for superseded closure cycles.
- Implementation, migration, build, functional testing and deployment remain pending the guarded implementation batch and milestone validation gate.
<!-- ATD-SCRIPT-470-REOPEN-STATISTICS-END -->

<!-- ATD-SCRIPT-492-DASHBOARD-SNAPSHOT-START -->
## Script 492 true Employee Dashboard snapshot previews

- Dashboard Studio built-in layouts now preview the actual Employee Dashboard renderer.
- Saved custom layouts preview their stored template, widgets, and appearance.
- Onboarding Template, Theme, and Review steps reuse the same snapshot renderer.
- Snapshot query overrides do not persist dashboard or appearance preferences.
- Selected action boxes and visible widgets are reflected in the Employee Dashboard snapshot.
- Frontend production build: PASSED locally.
- Database, email, notification, deployment, restart, commit, and push actions: NONE.
<!-- ATD-SCRIPT-492-DASHBOARD-SNAPSHOT-END -->

<!-- ATD-SCRIPT-502-ROUTING-NOTIFICATION-RECOVERY-START -->
## Routing, Notification Centre and runtime-recovery schedule

Updated: 2026-09-13 08:58:51

### Immediate recovery checkpoint

- Reconcile the interrupted Script 496 implementation before any rerun.
- Confirm whether structured ticket activity and the persistent Notification Centre were applied, rolled back, or partially applied.
- Do not rerun Scripts 496 or 497 until reconciliation is reviewed.

### Scheduled routing and refresh corrections

- Redirect /helpdesk to canonical /helpdesk/ in development and production.
- Direct refreshes on /helpdesk/ and nested authorised routes must load the SPA instead of a Vite or web-server error page.
- Production must provide the same canonical redirect and deep-link fallback behaviour.
- Authentication refresh must preserve the requested authorised route instead of displaying a technical error page.
- Terms and authentication endpoint failures must use governed retry and recovery handling.

### Scheduled Company Communications inactive-state handling

- Company Communications is a new feature whose initial activation remains pending.
- Dashboards must not repeatedly request an unavailable communications endpoint.
- Employees and agents must not see database or migration instructions.
- The inactive state should be hidden or say: Company announcements are not available yet.
- Administrators may see setup status without repeated console errors.

### Scheduled Notification Centre experience

- Provide All, Approvals, and Discussions filters.
- Provide Mark all as read and governed notification settings.
- Display actor initials or avatar, activity type, ticket reference, concise summary, and timestamp.
- Keep pending actions actionable after read-state changes.
- Protect action-required items from Clear completed.
- Preserve backend revalidation for Approve, Reject, Accept and Action, Return to Queue, and ticket or request navigation.

### Current execution order

1. Reconcile the interrupted Script 496 state.
2. Complete structured ticket activity and persistent Notification Centre if incomplete.
3. Collect and implement canonical /helpdesk/ routing and SPA refresh fallback.
4. Correct inactive Company Communications requests and console noise.
5. Continue remaining milestone validation and curated GitHub push.
6. Keep server deployment as a separate controlled activity.
<!-- ATD-SCRIPT-502-ROUTING-NOTIFICATION-RECOVERY-END -->

<!-- ATD-SCRIPT-509-NOTIFICATION-CENTRE-START -->
## Script 509 Notification Centre completion

- Structured searchable ticket activity table: IMPLEMENTED LOCALLY and retained.
- Shared Notification Centre wired into the Operations Dashboard: IMPLEMENTED LOCALLY.
- All, Approvals, and Discussions filters: IMPLEMENTED LOCALLY.
- Actor initials, notification type, reference, summary, and timestamp: IMPLEMENTED LOCALLY.
- Mark read, Mark unread, and Mark all as read: IMPLEMENTED LOCALLY.
- Opening the Notification Centre no longer marks notifications read automatically.
- Pending actions remain actionable after read-state changes.
- Clear completed excludes action-required notifications regardless of read state.
- Existing governed actions remain backend revalidated.
- Backend syntax validation and frontend production build: PASSED.
- Database, email delivery, notification delivery, Git, server, restart, and deployment actions: NONE.
<!-- ATD-SCRIPT-509-NOTIFICATION-CENTRE-END -->

<!-- ATD-SCRIPT-512-UI-ROUTING-BATCH-START -->
## Script 512 combined UI and routing batch

Updated: 2026-09-13 11:10:03

### Completed foundation

- Structured searchable ticket activity table and persistent Notification Centre are implemented locally.
- Notification Centre supports All, Approvals, Discussions, Mark read, Mark unread, Mark all as read, Settings, and protected pending actions.

### Current four-function group

1. Avatar identity consistency and header arrangement.
   - The Operations Dashboard avatar must use the same current profile image source as all other pages.
   - Avatar changes must immediately propagate to Dashboard, Ticket Detail, Employee pages, menus, and account components.
   - On Ticket Detail, the profile avatar/menu must be the far-right control, immediately after Ticket Monitor.

2. Ticket Activity Trail compact default.
   - Activity Trail must be collapsed or minimized by default.
   - Show only the latest three activities initially.
   - Provide View more and View less controls.
   - Preserve search and the complete chronological audit history.

3. Ticket Detail text-encoding and separator cleanup.
   - Remove mojibake and corrupted sequences visible in ticket metadata, reply placeholder text, attachment metadata, and upload guidance.
   - Remove the unwanted decorative separator bars identified in Ticket Detail.
   - Preserve meaningful labels, spacing, accessibility, and responsive behavior.

4. Canonical routing and inactive-feature recovery.
   - Redirect /helpdesk to /helpdesk/ in development and production.
   - Valid nested route refreshes must load the SPA, not a Vite or production web-server error page.
   - Preserve the requested authorised route during auth and terms checks.
   - Stop repeated inactive Company Communications requests and show nontechnical fallback messaging.

### Acceptance criteria

- A newly updated profile avatar is identical across Dashboard, Ticket Detail, Employee pages, and account menus.
- Ticket Monitor precedes the far-right profile avatar/menu on Ticket Detail.
- Activity Trail initially displays the latest three records and can expand to all records.
- No corrupted character sequences remain in the shown Ticket Detail areas.
- Unwanted separator bars are removed without removing meaningful information.
- /helpdesk canonical redirect and deep-link refresh work in development and production.
- Inactive Company Communications does not repeatedly create 503 console errors for ordinary users.
<!-- ATD-SCRIPT-512-UI-ROUTING-BATCH-END -->

<!-- ATD-SCRIPT-514-FIX-SCRIPT-513-VERIFIED-START -->
## Script 514 fix completion of Script 513

Updated: 2026-09-13 15:59:10

- Current source was audited before modification and all affected dependencies and surrounding functions were verified.
- Dashboard uses the shared ProfileAvatar component and retains the existing profile-avatar-changed refresh contract.
- Ticket Activity shows the latest three records by default with View more and View less controls.
- The existing searchable TicketActivityTable remains unchanged and available when expanded.
- Ticket Detail encoding artifacts were normalized to readable plain text.
- The reopen flow now refreshes through the defined fetchTicket function rather than the undefined loadTicket reference.
- OperationsShell already positioned Ticket Monitor before the far-right AccountMenu; no shell modification was required.
- Frontend production build: PASSED.
- Database, email, notification delivery, Git, server, restart, and deployment actions: NONE.
- Next normal implementation script: 514.
<!-- ATD-SCRIPT-514-FIX-SCRIPT-513-VERIFIED-END -->

<!-- ATD-SCRIPT-519-FIX-VERIFIED-ROUTING-START -->
## Script 519 fix: verified routing and inactive-feature recovery

Updated: 2026-09-13 22:07:08

- /helpdesk redirects to canonical /helpdesk/ in Vite development and Node-hosted production.
- Node-hosted production serves valid /helpdesk/* SPA refreshes through the built index while retaining static-file handling.
- PrivateRoute captures the requested in-application route before login and terms gates.
- Local login, Microsoft SSO completion, and terms acceptance return to a validated same-application route.
- Protocol-relative return values are rejected.
- Company Communications stops repeat feed requests for the browser session after a 404 or 503 response and shows a nontechnical availability message.
- Existing announcement read state, comments, moderation, attachments, and available-service behaviour remain intact.
- Frontend production build: PASSED.
- Database, email, notification delivery, Git, server restart, and deployment actions: NONE.
- Script 516 failed safely and rolled back before this exact-source implementation.
<!-- ATD-SCRIPT-519-FIX-VERIFIED-ROUTING-END -->

<!-- ATD-SCRIPT-535-ARCHIVE-LIFECYCLE-START -->
## Script 535 current-ticket archive lifecycle hardening
- Active Tickets navigation, recoverable Archived Tickets, and Pending Deletion views: IMPLEMENTED LOCALLY.
- Seven-day grace countdown and explicit pending-deletion classification: IMPLEMENTED LOCALLY.
- Restore authority restricted to Manager, Administrator, and Superadministrator; Agent and Operator restore prohibited: IMPLEMENTED LOCALLY.
- Permanent deletion restricted to Superadministrator after the grace period, with reason, typed confirmation, dependency checks, and tombstone evidence: IMPLEMENTED LOCALLY.
- Requester, Department, previous status, archive actor, archive reason, archive date, and governance state presentation: IMPLEMENTED LOCALLY.
- Backend syntax check and frontend production build: REQUIRED BY SCRIPT 535.
- Migration execution, functional testing, Git commit, push, server connection, restart, email, and deployment: NOT PERFORMED.
- Next unused script after successful completion: 536.
<!-- ATD-SCRIPT-535-ARCHIVE-LIFECYCLE-END -->

<!-- ATD-FORWARDING-PARTICIPATION-MILESTONE-20260927-BEGIN -->
## Forwarding and scoped ticket participation milestone

Status: **COMPLETED LOCALLY, MIGRATED AND COMPREHENSIVELY VALIDATED**

Completed:

- Forwarding and participation schema applied to PostgreSQL with `ticket_participants` and `ticket_forwarding_events`.
- Active participant duplicate prevention, expiry, revocation actor/reason, invitation state, access outcome and email outcome storage verified.
- Ticket Detail operations workspace for Forward Ticket and Invite Participant.
- Employee, department-email and governed external-email destinations.
- Read Only and Reply Only scopes with mandatory invitation or forwarding reason.
- Someone else's tickets on the Employee Dashboard.
- Branded invitation email function and direct authorised ticket link.
- Participant and forwarding history with governed revocation.
- Read-only reply and attachment-upload restrictions enforced through `canContribute`.
- Comprehensive milestone test passed with zero failures and zero warnings.
- Transactional test cleanup restored participant, forwarding-event, comment and ticket-history counts.
- Backend syntax and frontend production build passed.

Delivery controls:

- No validation email was sent.
- No permanent test data remains.
- No Git push, server restart, PM2 action or production deployment has been performed for this milestone.
- The working tree contains unrelated local work. Delivery must use selective staging and committed-file verification.
- Next script: 663, selective staging preparation and verification. Production deployment remains deferred.
<!-- ATD-FORWARDING-PARTICIPATION-MILESTONE-20260927-END -->

<!-- ATD-PENDING-BATCHES-20260927-BEGIN -->
## Consolidated pending implementation batches - 27 September 2026

The following backlog is preserved as four-function groups. Current forwarding and scoped-participation delivery remains the active release checkpoint. New implementation must not be mixed into that selective commit.

### Accelerated priority: Finance Workspace review prototype

1. **Finance task intake** - structured finance categories, requester, department, priority, due date, attachments and confidential-field rules.
2. **Finance task workspace** - List, Kanban, Preview and Statistics views with finance-specific filters and queues.
3. **Finance lifecycle and approvals** - review, information request, approval, in-progress, completion, rejection, cancellation and reopening states.
4. **Finance dashboard and meeting pack** - backlog, approvals, overdue work, categories, departments, owners, completion time and review questions for the Finance Manager.

Target: a reviewable prototype before the Finance Manager meeting beginning next week. The prototype is intended for correction and requirements feedback, not premature production deployment.

### Responsive dashboards, panels and universal header

1. Responsive Employee, Agent and Operations dashboards that reflow at browser zoom without omitting authorised content.
2. Right-side panel semantics: pinned panels consume layout space and reflow blocks; unpinned panels overlay the page; the width slider controls governed panel width and preferences persist per user/screen mode.
3. Universal non-overlapping header order from left to right: Refresh, New Request, Ticket Monitor, Profile Avatar at the far-right; move Logout into the profile menu.
4. Zoom and overflow validation at 100%, 125%, 150%, 175% and 200%, including tables, Kanban, charts, saved layouts and panel states.

### Compact Ticket Detail controls

1. Keep compact People information visible: requester, owner, support group, assignment state and participant/collaborator counts.
2. Keep Status, status dropdown, Resolve and compact SLA/timing information visible.
3. Move assignment, collaborator, participant, forwarding, lifecycle and other advanced ticket actions into contextual three-dot menus and action drawers.
4. Hide Assign to Me when an individual assignee or active assignment proposal already exists; show only valid contextual ownership actions.

### Closed-ticket lifecycle enforcement

1. Disable or hide actions applicable only to open tickets after closure.
2. Keep read-only details, conversation, attachments, audit, SLA, escalation and participation history available.
3. Make governed Reopen the primary lifecycle action, with reason, actor, timestamp, cycle number and repeat-issue flag.
4. Restore eligible open-ticket actions only after successful reopening and permission checks.

### Assignment and multi-group support governance

1. Selecting an assignee automatically selects the person's only eligible support group.
2. If the person belongs to multiple groups, require selection of the owning group.
3. Configure per-membership ticket-opening alerts for all groups, selected groups, owning group only or no groups.
4. Allow group membership and assignment eligibility without sending ticket-opening group alerts; audit ticket-specific overrides and delivery outcomes.

### Governed escalation workflow

1. Separate escalation state from ordinary ticket lifecycle status.
2. Capture escalation type, level, target, reason, expected action, ownership effect and acknowledgement deadline.
3. Track raised, delivered, acknowledged, in-progress, resolved, de-escalated and cancelled states.
4. Add portal/email/Teams notifications, escalation SLA, audit evidence and management reporting.

Current observation: Escalated appears to operate mainly as a status change. Full governed escalation remains pending.

### Email-first authentication routing

1. Ask for and validate the email address before selecting an authentication method.
2. Route configured ATD Alliance domains to M365 SSO with login hint and return-path preservation.
3. Route approved non-company accounts to local email/password authentication without forcing M365.
4. Add change-email, rate limiting, similar-domain protection, account-state checks and governed fallback rules.

### Universal Excel-style table filtering

1. Add per-column dropdown filters with searchable distinct values, Select All and checkboxes.
2. Add data-type-aware filters for text, dates, numbers, statuses, blanks and ranges using server-backed authorised values.
3. Combine column filters correctly with global search, sorting, pagination, saved views and List/Kanban switching.
4. Reuse the table-filter framework across User Administration, tickets, Ticket Monitor, archive, access, assets, directory, notifications, Finance Workspace, reports and audit tables.

### New-ticket attention and acknowledgement

1. Track a New state per assignment cycle until the current direct assignee opens the ticket.
2. Show New badges and five accessible visual pulses at 30-second intervals in Workspace List/Kanban, Ticket Monitor List/Kanban, Dashboard and Priority Queue.
3. Increment and pulse the notification badge for up to 15 seconds; opening Notification Centre stops badge animation, while opening the ticket acknowledges the assignment.
4. Send deduplicated browser notifications where permission exists, with optional sound, reduced-motion support and assignment-to-first-open reporting.

### Notification Centre completion

1. Repair assignment notification Open actions, payload/reference mapping, legacy compatibility and safe ticket-opening fallback.
2. Preserve actionable pending items after Mark as Read.
3. Support detailed event settings and portal/email/Teams delivery governance.
4. Report delivery, seen, opened, ticket-opened and assignment-acknowledged states separately.

### Conversation, activity and change controls

1. Capture complete public conversation and internal-note activity with participant, origin and timestamps.
2. Default responses to requester-visible; require explicit operations-only internal-note selection.
3. Add compact centred change notifications with safe Undo and detailed confirmations.
4. Add later notification history and a separate detailed Activity view.

### Bulk ticket operations

1. Bulk selection in Workspace List/Kanban and Dashboard Priority Queue.
2. Governed bulk edit and resolution preparation with per-ticket eligibility results.
3. Governed archive/delete with confirmation, reason, partial-failure handling and audit evidence.
4. Optional Teams confirmation prompts and consolidated results.

### Ticket Workspace, filtering and search

1. Complete List/Kanban/Preview/Statistics and saved views.
2. Broad filters for Department, Requester, Priority, status, incident type, service request type, assignee, support group, dates, SLA and reopened state.
3. Priority Queue scope: assigned directly to me, my support group or both.
4. Universal authorised word-or-sentence search across reference, subject, description, requester, department, assignee, group, category, status, priority and conversation.

### Reopened and repeat issues

1. Permit governed employee reopening of eligible resolved tickets.
2. Track resolution cycles, reopen reasons, actors and timestamps.
3. Show repeat-issue indicators in Ticket Detail, queues, dashboards and reports.
4. Report reopen count, recurrence categories and time from resolution to reopen.

### Attachments and surveys - later batches

1. Attachment previews and full-screen viewing with governed access.
2. Attachment gallery, metadata, download controls and missing-file handling.
3. Short survey after meaningful assistance/resolution or final closure, without duplicate survey spam.
4. Survey reporting, low-rating follow-up and optional governed reopening. Survey work remains later than Finance preparation.

### Access, visuals, reporting and organisational modules

1. Access requests: grey out existing functions, show granted-access source and keep governed revocation.
2. Light/Dark mode and named responsive dashboard-layout templates.
3. Interactive reporting drill-downs preserving filters and underlying ticket links.
4. Complete department, support-group and management workspaces after the accelerated Finance prototype.

### Communications, directory, rebranding and post-deployment architecture

1. Company Communications audiences, exclusions, external recipients and landing-page announcements.
2. Microsoft Directory no-op protection and Monday 08:00 consolidated change alerts attached to Weekly Reports.
3. Preserve and rebrand CMDB after a replacement name is selected; fix avatar cache refresh and fallback behaviour.
4. After deployment, produce modular architecture docs, ADRs, function rationale records, failure-mode register and decision playbooks.

### Delivery sequence

1. Finish the forwarding-participation selective staged tree, validate, commit, push, review, deploy and verify.
2. Accelerate the Finance Workspace prototype for next week's review meeting.
3. Repair the Notification Centre assignment-action defect.
4. Execute the responsive layout and compact Ticket Detail batches, followed by assignment governance and escalation.
5. Continue remaining four-function batches by dependency and launch priority.
<!-- ATD-PENDING-BATCHES-20260927-END -->

<!-- ATD-POST-MILESTONE-20260927-BEGIN -->
## Forwarding milestone closure and next-batch activation - 27 September 2026

### Delivered and pushed

- Forwarding and scoped ticket participation was selectively committed and pushed to `feature/launch-communications-queue-compatibility`.
- Verified commit: `edf97e4876d09d6e8120377a35a39b55896e61a7`.
- Verified tree: `904ce7c9027269fd22f8b5175425b86851c0a731`.
- Clean staged-tree backend syntax, tracker JSON, migration structure and frontend production build passed.
- Deployment-readiness review passed for the pushed commit.
- Production deployment remains blocked until the deployment target, database backup and participation migration status are confirmed through the authorised production procedure.

### Activated next delivery stream: Finance Workspace prototype

1. **Finance task intake** - structured categories, requester and department context, confidentiality, attachments, priority and due date.
2. **Finance workspace** - List, Kanban, Preview and Statistics with finance filters, queues and role-aware access.
3. **Finance lifecycle and approvals** - review, information request, approval, rejection, progress, completion, cancellation and reopening.
4. **Finance dashboard and meeting pack** - backlog, approvals, overdue work, categories, departments, owners and Finance Manager review questions.

Target: a reviewable prototype before the Finance Manager meeting beginning next week. Build for review and correction first, not premature production deployment.

### Activated responsive layout and universal controls batch

1. Pinned right panels consume layout space and reflow page blocks; unpinned panels overlay the page.
2. The width slider controls governed panel width and persists per user and screen mode.
3. Universal header order is Refresh, New Request, Ticket Monitor, Profile Avatar, with the avatar fixed at the far-right and no overlap.
4. Validate Employee, Agent and Operations pages at 100%, 125%, 150%, 175% and 200% zoom without omitting authorised functions.

### Global change popup, Undo and lifecycle navigation

1. Status and change popups render through a portal-level overlay above headers, panels, menus and page content.
2. Popups remain brief, pause on hover or keyboard focus and retain a governed Undo action during the permitted reversal window.
3. Resolving or closing a ticket from Ticket Detail exits the record and navigates to the relevant Resolved or Closed queue while preserving the originating workspace where possible.
4. Queue counters, List, Kanban, Ticket Monitor, Dashboard and preview state update immediately without duplicate records.

### Ticket closure wording and behaviour

- User-facing action label is **Close** or **Close ticket**, never **Governed Close**.
- Governance remains internal through permissions, mandatory reason, confirmation, audit, lifecycle restrictions and authorised reopening.
- Closed tickets disable actions applicable only to open tickets while preserving read-only history and authorised Reopen.

### Assets Management naming decision

- Full module name: **Assets Management**.
- Sidebar and compact navigation label: **Assets**.
- Remove user-facing **CMDB** and **Assets / CMDB** wording across navigation, pages, permissions, notifications, reports, search and documentation.
- Preserve existing asset functionality, records, relationships, permissions, routes, audit data and backward compatibility.

### Immediate execution order

1. Collect exact Finance Workspace and reusable workspace-module source context.
2. Build the four-function Finance prototype batch.
3. Continue the responsive layout and universal controls batch.
4. Implement compact Ticket Detail, lifecycle navigation, global popup and Undo, and closed-ticket restrictions in dependency order.
5. Complete Assets Management rebranding in its scheduled portal-wide batch.
6. Resume controlled deployment only after authorised target, backup and migration-status confirmation.
<!-- ATD-POST-MILESTONE-20260927-END -->

<!-- ATD-FINANCE-COMMERCIAL-INTELLIGENCE-20260927-BEGIN -->
## Finance Workspace commercial intelligence, reporting and security scope - 27 September 2026

### Product vision

The Finance Workspace must operate as a secure Finance and Commercial Intelligence workspace, not only as a ticket queue. Structured information captured once must support operational processing, approvals, management dashboards, Boardroom packs, clean Excel exports, reconciliations, forecasting and decision-making.

### Finance organisational model

1. **Finance Main and CFO Office** - executive Finance work, strategy, budgets, forecasts, reporting, treasury, audit, compliance, confidential correspondence and escalations.
2. **Accounts Payable Office** - supplier invoices, supplier payments, employee payments and reimbursements, sales orders, purchase-order matching, payment batches, supplier queries and payment exceptions. This office has its own manager and operational queues.
3. **Finance Boardroom** - a governed meeting and decision space for agendas, review packs, decisions, action items and point-in-time reporting snapshots. The Boardroom is not a support group or default assignee.
4. **Entra-backed organogram** - use read-only department, job title, manager, office location, company, employee type, account status and object ID references. Do not invent names or write back to Microsoft Entra ID. Suggested membership requires governed review.

### Finance process catalogue

- Supplier invoice
- Supplier payment
- Employee payment
- Employee reimbursement
- Sales order processing
- Purchase-order matching
- Payment exception
- Supplier query
- Budget review
- Financial reporting
- Audit request
- Boardroom review
- General Finance request

### Product and commercial data model

Use governed product families and line items so one invoice or order can contain multiple products:

- `RSB` - Rear Step Bumpers
- `CF` - Chassis Frames
- `TG` - Tailgates
- `BL` - Bedliners
- `BR` - Box Rails
- `EC` - Endcaps
- `OTHER` - Other or uncategorised products

Capture product family, product code, description, customer and internal part numbers, variant, programme or model, customer, site, unit of measure, quantity, unit price, discount, tax, net line value, currency, cost centre and effective dates. Preserve future mapping to Syspro or another authoritative product master.

### Structured Finance data capture

Capture dedicated fields rather than hiding reportable values in descriptions or comments. The data model must support Finance office, process, transaction type, customer, supplier, employee reference, invoice, purchase order, sales order, delivery note, payment batch, document and due dates, quantities, amounts, currency, exchange rate, local-currency value, cost centre, department, general-ledger reference, approval state, payment state, reconciliation state, confidentiality, owner, completion and reopened indicators.

### Reporting and presentation readiness

Provide Executive Finance, Product Performance, Accounts Payable, Finance Manager and Boardroom reporting. Reports must support daily, weekly, monthly, quarterly, year-to-date, financial-year and custom periods. Every chart and headline value must drill into the exact authorised records represented while preserving active filters.

Required measures include units, gross value, discount, tax, net value, local-currency value, paid and unpaid value, approved and pending value, overdue value, processing time, approval time, exceptions, reopened items, blocked payments, completion rate, on-time payment rate and invoice-to-payment cycle time.

Boardroom packs must be point-in-time snapshots containing reporting period, refresh timestamp, filters, executive summary, KPIs, charts, variances, exceptions, commentary, decisions required and underlying record count.

### Clean Excel exports

Provide governed `.xlsx` exports for detailed Finance data, product sales, Accounts Payable, approvals and management packs. Management workbooks should include Summary, Product Performance, Accounts Payable, Approvals, Overdue Items, Office Workload, Exceptions, Detailed Data, Data Dictionary and Export Metadata sheets.

Raw-data sheets must use one header row, one record per row, one attribute per column, genuine Excel dates, numeric money and percentages, separate currency columns, stable names, record IDs, source references, filters, export timestamp, classification and exporter identity. Do not use merged cells or decorative blank rows in raw-data sheets.

Every workbook must contain a Data Dictionary describing column name, business meaning, type, allowed values, mandatory status, source, classification, calculation rule and example.

### Data quality controls

Detect duplicate supplier invoices, missing supplier or amount, invalid currency, unjustified negative values, invalid date order, payment before approval, quantity without product, missing customer where required, line totals not matching document totals, tax inconsistency, missing purchase order, missing approval, missing supporting documents, invalid cost centre, invalid Finance office and conflicting confidentiality. Status values are Valid, Incomplete, Needs Review, Exception and Blocked.

### Finance security baseline

1. Enforce least privilege and separate Requester, Processor, Reviewer, Approver, Payment Releaser, Workspace Manager, Finance Security Administrator, Auditor and Boardroom Participant roles.
2. Prevent one person from requesting, processing, approving and releasing the same sensitive transaction unless an authorised exception is recorded.
3. Support confidentiality levels: Internal, Finance Restricted, Confidential, CFO Restricted, Boardroom Restricted, Payment Restricted, Employee Financial Information and Supplier Banking Information.
4. Restrict sensitive fields, previews, downloads and exports independently from general workspace visibility.
5. Record every view, download, export, approval, decision, change and access-revocation event.
6. Confidential uploads remain disabled until protected storage, extension and signature validation, generated filenames, size controls, malware scanning, CSRF protection, retention and authenticated download controls are configured and reviewed.
7. Plan Microsoft Entra MFA, Conditional Access, trusted or compliant device rules, session controls and step-up authentication through the authorised identity-security process.

### Updated four-function prototype batch

1. **Finance organisation and secure intake** - offices, organogram references, process catalogue, classifications, structured forms, product lines and data-quality validation.
2. **Finance operations workspace** - office selector, List, Kanban, Preview, Statistics, Accounts Payable, CFO, approval, overdue, exception, product and period queues.
3. **Finance lifecycle and controls** - information requests, approvals, separation of duties, payment states, exceptions, completion, reopening, restricted fields and audit history.
4. **Finance intelligence and reporting** - executive, Accounts Payable and product dashboards, Boardroom pack, drill-down reporting, clean Excel exports, data dictionary and export auditing.

### Delivery guardrails

Build a reviewable prototype with structured configuration and no fabricated financial values. Real data enters only through authorised integration or governed manual capture. Review terminology, workflow and security with Finance leadership before enabling confidential document upload or production deployment.
<!-- ATD-FINANCE-COMMERCIAL-INTELLIGENCE-20260927-END -->

<!-- ATD-FINANCE-READINESS-ROSTER-NAMING-20260927-BEGIN -->
## Finance prototype readiness, provisional roster and pre-deployment naming - 27 September 2026

### Finance prototype readiness

- Finance Workspace prototype foundation implemented locally.
- Backend JavaScript syntax passed.
- Frontend production build passed with 2,469 modules transformed.
- Finance readiness test passed with 0 failures, 4 expected warnings and 66 passing checks.
- Finance migration created but not executed.
- Confidential Finance uploads remain disabled pending security readiness.
- Genuine XLSX generation remains pending an approved workbook service or dependency.
- Microsoft Entra organogram mapping remains read-only and tenant verification is pending.

### Provisional Accounts Payable Office roster

1. Sibongile Jele - Accountant
2. Phindile Ntuli - title pending Entra verification
3. Lindokuhle Malevu - Accountant Assistant
4. Francina Tshabalala - title pending Entra verification
5. Mpho Mnisi - title pending Entra verification
6. Tshepo Maroga - title pending Entra verification
7. Hlengiwe Lubisi - title pending Entra verification
8. Bhekumuzi Thubana - title pending Entra verification
9. Sesihle Sanka - title pending Entra verification
10. Cynthia Cannela - title pending Entra verification
11. Suphaporn - Office Manager

### Provisional Finance Main and CFO Office roster

1. Puseletso Sithole - title pending Entra verification
2. Ayanda Mbatha - title pending Entra verification
3. Lutho Mafunda - title pending Entra verification
4. Khumbudzo Mutheiwana - title pending Entra verification
5. Mncedisi Valashiya - Accountant Manager
6. Bongani Tshabalala - Finance Manager

### Roster governance

- Names and supplied titles are provisional until matched to approved ATD Alliance Entra accounts.
- Verify display name, user principal name, mail, job title, department, office location, employee type, account status, object ID and manager.
- Ambiguous, guest, disabled or unmatched accounts require manual review.
- Entra matching does not automatically grant Finance Workspace access.
- Workspace office and role assignments require authorised approval.
- No Entra write-back is permitted.

### Pre-deployment naming completed

- Sidebar module label standardised to `Assets`.
- Assets page and dashboard template standardised to `Assets Management`.
- User-facing `Governed Close` standardised to `Close`.
- Ticket Detail closure confirmation standardised to `Ticket closed successfully.`
- Technical governed-closure route and controls preserved.
- Existing Assets route, data identifiers and functionality preserved.
- Portal-wide stale user-facing naming scan passed.
- Frontend production build passed after naming changes.

### Deployment boundary

Before deployment, selectively stage, validate, commit and push the Finance prototype, naming repairs and this tracker update. Deploy only remote-verified commits. Confirm the production target, database backup, migration status and rollback point before applying the Finance migration or restarting services.
<!-- ATD-FINANCE-READINESS-ROSTER-NAMING-20260927-END -->
<!-- ATD-URGENT-RELEASE-CHECKPOINT-20261004-BEGIN -->
## Urgent release delivery checkpoint - 4 October 2026

### Completed and validated
- Finance Workspace review prototype foundation is implemented in the selective release.
- Finance backend route, frontend page, application route, Sidebar entry and API client are included.
- Notification Centre ticket-opening compatibility now resolves numeric IDs, target URLs, target IDs and legacy REQ, INC and TMP-FS ticket references through an authorised exact-reference fallback.
- Compact navigation uses **Assets** and the module page uses **Assets Management** while existing asset routes and data remain preserved.
- User-facing ticket closure wording is standardised to **Close** and `Ticket closed successfully.`
- Exact urgent-release patch validation passed for 14 approved paths.
- Isolated staged-tree backend syntax and frontend production build passed with 2,469 modules transformed.
- Selective commit `86c8b876b5313f3748378db87b3b25cc77b21871` was created and verified.
- Verified commit tree: `4e4948d001b840f4742d08d68210773621e22e86`.
- Post-commit Git index is clean.

### Delivery state
- Tracking remote identified as `gitlab`.
- Secondary remote identified as `github`.
- Push has **not** been performed. Script 741 stopped safely because the repository has no remote named `origin`.
- No production deployment, migration execution, server restart, PM2 action or live communication occurred.
- Finance migration `2026-09-27-finance-workspace-prototype.sql` remains created but unapplied.
- Production target, database backup, migration state and rollback point still require authorised confirmation before deployment.

### Next guarded actions
1. Push and verify commit `86c8b876b5313f3748378db87b3b25cc77b21871` through the verified `gitlab` tracking remote.
2. Confirm the remote commit, parent, tree, subject and exact 14-path allowlist.
3. Inspect production target, backup readiness, migration state and rollback evidence before any deployment.
4. Keep the Finance migration unapplied until the authorised deployment gate is satisfied.
5. Continue Finance Accounts Payable and commercial-intelligence expansion as the next Finance function group after delivery control.
6. Continue the responsive layout and universal-header batch. The required top-header New Request and Ticket Monitor controls remain pending.
7. Preserve the broader unrelated local working tree outside this selective release.
<!-- ATD-URGENT-RELEASE-CHECKPOINT-20261004-END -->

<!-- ATD-SCRIPT-774-FINANCE-EMAIL-OPERATIONS-START -->
## Script 774 urgent Finance email-ticketing operations batch
- Finance employee responsibility registry: IMPLEMENTED LOCALLY.
- Authorised Finance mailbox and external sender registry: IMPLEMENTED LOCALLY.
- Actionable email triage foundation and Finance operational metadata: IMPLEMENTED LOCALLY.
- Unattended queues and Finance Manager delegation history: IMPLEMENTED LOCALLY.
- Migration execution, Graph mailbox activation, functional testing, commit, push and deployment: PENDING.
<!-- ATD-SCRIPT-774-FINANCE-EMAIL-OPERATIONS-END -->
<!-- ATD-SCRIPT-777-FINANCE-BATCH-2-START -->
## Script 777 Finance operations batch 2
- Mailbox administration and routing rules: IMPLEMENTED LOCALLY.
- External sender governance and verification: IMPLEMENTED LOCALLY.
- Finance Manager triage and bulk delegation API: IMPLEMENTED LOCALLY.
- Email intake Finance enrichment and unattended timers: IMPLEMENTED LOCALLY.
- Migration execution, Graph processing, functional testing, commit, push and deployment: PENDING.
<!-- ATD-SCRIPT-777-FINANCE-BATCH-2-END -->
<!-- ATD-SCRIPT-779-781-FINANCE-BATCH-3-START -->
## Finance schema activation and operations batch 3
- Script 779 local PostgreSQL backup and Finance operations migration: COMPLETE AND VERIFIED.
- Finance office foundation and governed office records: APPLIED LOCALLY.
- Finance employee responsibility and manager-governed duty administration: IMPLEMENTED LOCALLY.
- Finance office administration and employee-office allocation: IMPLEMENTED LOCALLY.
- Authorised Finance mailbox administration with routing ownership and response targets: IMPLEMENTED LOCALLY.
- External sender verification, blocking and Finance-function governance: IMPLEMENTED LOCALLY.
- Existing operational row counts preserved during migration: VERIFIED.
- Email and Microsoft Graph processing: NOT RUN.
- Broad Finance functional testing: DEFERRED TO FINANCE MILESTONE BOUNDARY.
- Commit, push, server restart and production deployment: NOT PERFORMED.
<!-- ATD-SCRIPT-779-781-FINANCE-BATCH-3-END -->
## Finance production activation and repair checkpoint - 8 October 2026
<!-- ATD-TRACKER-CHECKPOINT-2026-10-08-FINANCE-PRODUCTION-REPAIRS -->

### Completed and production-verified
- Finance milestone activation completed and production health verified through Script 799.
- Static JavaScript and CSS access failure diagnosed and repaired through Scripts 800-803. Active Helpdesk and Production frontend assets return HTTP 200.
- Ticket-detail blank-screen defect repaired through Scripts 804-806 by removing the bare useRef(...) runtime failure, rebuilding the frontend and deploying the validated hashed assets.
- Finance Workspace generic server error diagnosed through Scripts 807-808 against the actual atd_helpdesk database.
- Finance Workspace dashboard and queue scope repaired through Script 809 by removing the invalid tickets.workspace_id dependency and using the existing tickets.workspace field.
- Script 809 production validation passed: dashboard SQL passed, queue SQL passed, PM2 restart succeeded and API health returned HTTP 200.

### Current Finance Workspace state
- Finance schema is present in the atd_helpdesk database.
- Three Finance offices are present.
- Finance employee responsibility, mailbox, external sender, ticket operations and delegation tables are present and currently contain no operational records.
- Finance dashboard and queues are expected to show zero until Finance employees, governed mailboxes, external senders and Finance-classified tickets are loaded.
- Confidential uploads remain disabled and unattended-email processing remains inactive until the governed activation boundary.

### Next Finance milestone work
- Load and validate the complete Finance employee roster, offices and Finance Manager responsibility assignments.
- Configure authorised business mailboxes, default routing, backup assignees, response targets and sender scope without enabling live email processing.
- Load governed external senders and verification states.
- Validate Finance ticket classification, delegation, unattended-item indicators, operational queues and management reporting with controlled test records.
- Complete presentation-ready Finance reporting and clean Excel exports for Rear Step Bumpers, Chassis Frames, Tailgates, Bedliners, Box Rails and Endcaps.
- Run one comprehensive Finance milestone test only after the remaining Finance functions are complete, followed by one controlled server push and one consolidated milestone report.

### Deferred technical improvement
- Split the large frontend production chunk. The current build is functional, but the main JavaScript bundle exceeds the Vite 500 kB warning threshold.

### Guardrails retained
- Do not enable live email or Microsoft Graph processing during routine development.
- Preserve existing Helpdesk, Production, CMDB and ticket functionality.
- Use atddev for production SSH and deployment operations.
- Continue sequential script numbering from Script 810 and keep repair scripts in lowercase underscore naming format.
- Keep tracker filenames, structure and historical content intact.

## Script 818 - Global ticket governance 10-function batch
Implemented locally: governed default support groups, assignee-derived locked groups, requester priority restrictions, governed Incident and Service Request catalogue evidence, external-email source and Important status, and hierarchy-based escalation with audit. Migration created but not executed. Testing remains deferred to the milestone boundary. No deployment performed.


## Script 820 - Global ticket experience 10-function batch
Implemented locally: global availability, assignment guards, configurable group alerts, collaboration and CC completion, Teams contract preparation, complete conversation feed, post-resolution surveys, attachment-preview validation, expanded audit confirmations, and popup/Undo activity coverage. Migration created but not executed. Testing deferred. No deployment performed.


## Script 824 - Pre-deployment authentication, ticket visibility and Dark mode schedule

**Status:** Scheduled before the next production deployment
**Priority:** Launch-critical pre-deployment

### Functions
- 1. Validate the submitted sign-in identifier as an email address before authentication options are shown.
- 2. For verified @atdalliance.co.za addresses, show Microsoft SSO as the only standard sign-in option.
- 3. Hide and disable password entry for @atdalliance.co.za accounts unless the account has server-verified IT department membership.
- 4. Prevent client-side department claims from unlocking password authentication; the exception must be authorised by backend directory/account data and audited.
- 5. Sort Ticket Workspace lists by newest-created ticket first unless a user deliberately selects another supported sort.
- 6. Sort Ticket Monitor lists by newest-created ticket first unless a user deliberately selects another supported sort.
- 7. Sort Dashboard Priority Queue results by newest-created ticket first unless a user deliberately selects another supported sort.
- 8. Display a consistent New ticket tag across Ticket Workspace, Ticket Monitor and Priority Queue, using one governed definition and expiry rule.
- 9. Include New-ticket state and tag evidence in escalation workflow displays and preserve readable ticket descriptions in Dark mode.
- 10. Place Ticket Monitor and the Light/Dark toggle beside the profile control, with responsive collision protection so the avatar never covers either control.

### Acceptance criteria
- SSO routing is determined from a normalised case-insensitive email domain.
- The IT password exception requires verified active-account and department membership; changing page markup or request payloads cannot enable it.
- Existing external/local account authentication remains available according to current policy.
- New-ticket ordering is deterministic: created_at DESC with a stable secondary key.
- The New tag uses one shared backend/frontend rule across all three ticket surfaces.
- Dark-mode description text meets readable contrast and does not inherit light-mode translucent or blurred styling.
- Header controls remain visible at supported desktop and responsive widths and do not sit behind the floating profile control.
- Closed-ticket action restrictions, current access controls, audit history and existing ticket filters remain intact.
- Implementation and focused validation must complete before the next production deployment.
- Comprehensive milestone testing remains consolidated at the milestone boundary.

No application, authentication, database, deployment, email, Microsoft Graph, Teams, service, or Git action was performed by Script 824.


## Script 838 - Finance Department workspace completion and model-ready knowledge consolidation

**Status:** Implemented locally; milestone validation and production deployment remain blocked.
**Navigation:** Operations side navigation now presents **Workspaces** followed by **Finance Department**, routed through `/finance-workspace`.

### Completed
- Verified the Finance frontend workspace and its backend API surface for configuration, dashboard, employees, mailboxes, queues, prioritisation, delegation, delegation history and export contract.
- Preserved verified Finance access controls based on department membership, approved Finance positions, manager-reporting scope, governed override and audit evidence.
- Consolidated Scripts 836 and 837 outcomes into the existing tracker history.
- Added model-ready implementation and failure-learning context to the existing governance and conversation-context documents.

### Finance milestone validation gate
- Validate Finance employee population and authorised reporting scope.
- Validate actionable-email triage, unattended detection, delegation, priority and due-date controls without enabling live Graph processing.
- Validate structured capture and reporting for Rear Step Bumpers, Chassis Frames, Tailgates, Bedliners, Box Rails and Endcaps.
- Validate presentation-ready dashboards and reviewed Excel export before any download.
- Validate confidentiality boundaries, audit evidence and manager-only reporting scope.
- Implement governed catalogue-item administration, including default priority and whether requester editing is locked.
- Expand SLA bar detail to show policy source, response/resolution targets, elapsed/remaining time, deadlines, pause status and breach state.

### Deployment boundary
Production migration, production data sync, email processing, Graph processing, service restart and server deployment were not performed. The next production action remains blocked until the Finance milestone receives one consolidated functional test and deployment-readiness report.

## Script 841 username-first authentication and station operators
- Server-authoritative username/email routing: implemented locally.
- Verified company-domain employees route to Microsoft SSO.
- Superadministrator and approved local identities use password authentication.
- Plant operators may request username-based station accounts without email; plant and station are compulsory and approval remains required.
- Migration created but not executed; production deployment and milestone functional testing not performed.


## Script 845 - Shared workspace templates and no-code catalogue manager
- Workspaces confirmed as the central IT/developer-governed departmental framework.
- IT Workspace Template introduced as the reusable default for departmental workspaces.
- Shared incident and service-request catalogue-item model created for all workspaces.
- No-code Add, Edit, Duplicate, Activate, Deactivate, Archive and History APIs added.
- Catalogue Manager interface added under Workspaces.
- Other is a governed untemplated route: category/sub-category/workspace context is preserved while Short Summary, Description and Priority remain editable.
- Existing tickets retain catalogue snapshots and are not silently rewritten when a template changes.
- Migration created but not executed; milestone functional testing and production deployment remain pending.

## Script 853 - Catalogue grid admin controls and icon picker
- Admin/superadmin users receive an Add or manage catalogue items control directly above the requester catalogue item grid.
- The control routes to the shared Catalogue Manager rather than introducing a second administration engine.
- Catalogue Manager now exposes a portal icon picker using the existing catalogue icon library, with automatic item-name icon matching and an editable supported icon key.
- Existing production-synchronised Incident and Service Request records, Other routes, and local-only items are preserved.
- Requester catalogue remains managed-database-first with catalogService.js compatibility fallback.
- Process Engineering and Finance remain next departmental consumers of the shared workspace/catalogue template architecture.

## Script 854 - Request for Someone Else managed catalogue propagation
- Added beneficiary=self|other propagation from Request Catalogue into catalogue-item ticket navigation.
- Ticket creation now reads beneficiary context from URL/navigation state.
- For Someone Else requires an explicit requester selection before submission.
- requesterId remains the submitted beneficiary identity while backend requester_id and created_by_user_id remain separate.
- Managed Service Catalogue and existing catalogue fallback are preserved.
- Full milestone functional testing remains deferred until milestone completion.

## Script 856 - Grouped Catalogue Manager explorer
- Replaced the flat catalogue inventory with a workspace/type/category grouped explorer.
- Added summary cards, full-text search, catalogue-type filter, priority filter and state filter.
- Added collapsible category groups with item counts and compact item tables.
- Preserved Add/Edit/Duplicate, icon picker, managed catalogue APIs and existing catalogue records.

## Script 858 - Portal mouse-wheel scroll repair and catalogue UX close
- Corrected Ticket Workspace vertical scroll ownership for mouse-wheel and trackpad input.
- Removed vertical overscroll containment from the Ticket Workspace list chain while preserving horizontal Kanban containment and modal scrolling.
- Added stable scrollbar gutter and explicit portal scroll-chain semantics.
- Catalogue Manager grouped explorer from Script 856 remains complete and preserved.
- This closes the catalogue/portal-UX implementation batch; Finance and Process Engineering (PDM) are next.

## Script 860 - Finance and PDM shared catalogue completion
- Finance consumes the shared managed workspace catalogue and exposes it inside Finance Workspace.
- Existing Finance triage, delegation, employee, office, mailbox, external-sender, access-scope and product-family foundations are preserved.
- PDM now consumes the shared managed workspace catalogue first with the existing PDM catalogue retained as fallback.
- PDM exposes governed plant/line/station/machine/product/process ticket context endpoints backed by the existing pdm_ticket_context model.
- Broad Finance/PDM milestone testing remains deferred until departmental implementation is fully complete.

## Script 862 - Finance access-context API and local auth diagnostics
- Restored financeWorkspaceApi.accessContext() to match FinanceWorkspace and the existing /finance-workspace/access-context backend route.
- Improved development-only local-login failure diagnostics without changing passwords, hashes, account policy or authentication routing.
- Local/company username-first routing and Microsoft SSO requirements remain governed by the existing authentication contract.

## Script 863 - Sprinto-style login options and authentication repair batch
- Added identifier-first Next flow with a dedicated server-authorised sign-in-options step.
- Added Microsoft and Local password option cards, Use another account, Other sign-in options and clear busy/error states.
- Company accounts remain Microsoft-routed unless the existing backend policy explicitly authorises local password.
- Superadmin/local/station password behavior remains governed by backend account attributes.
- Corrected AuthContext terminology so the login identifier may be an email address or username.
- Preserved development-only detailed local-login diagnostics from Script 862.


## Script 870 - PDM and Finance dashboard completion batch
- Status: Implemented locally; milestone functional testing deferred.
- Added governed PDM analytics, KPI drill-down, persistent department filters, catalogue-to-queue filtering, and direct ticket navigation.
- Added Finance reporting-summary endpoint with unattended, overdue, email-origin, workload breakdowns, and structured product-family contract.
- Preserved existing Finance triage, delegation, mailbox, external-sender, administration, catalogue, access, and export-contract behavior.


## Script 871 - Finance correspondence monitoring
- Status: Implemented locally; live Graph activation and milestone functional testing remain governed/deferred.
- Added authorised mailbox delta-sync foundation, important/management/external classification, correspondence audit events, unattended and overdue flags, manager sync control, and Finance dashboard correspondence monitor.
- Microsoft Graph secrets remain environment-only. Monitoring requires explicit mailbox authorisation and monitoring enablement.


## Script 874 - Finance and PDM department completion
- Status: Implemented locally; comprehensive functional testing remains deferred to the combined department milestone boundary.
- Finance: correspondence actions, governed conversion through the existing email-ticket engine, configuration-aware monitoring status, mandatory export review and multi-sheet XLSX.
- PDM: structured production context UI, recent activity, SLA breach reporting, mandatory export review and multi-sheet XLSX.

## 2026-10-29 Finance Workspace, Authentication, Catalogue and Communications Checkpoint

### Completed and locally validated

- Scripts 888-893 established the Finance Workspace shell, Executive Overview, Finance request creation, ticket register, My Work, Finance email intake foundations, journals, reconciliations, Month-End Close, governance, evidence, access requests, notifications, people administration and KPI foundations.
- Script 895 completed the username-first authentication repair:
  - Active `@atdalliance.co.za` employee accounts use Microsoft SSO by default.
  - Active non-company local accounts with passwords receive password login.
  - Superadministrator and station/operator local-password access remains available.
  - The authorised account `jeffreym@atdalliance.co.za` has governed Microsoft SSO and local-password options.
- Script 896 completed after exact-schema corrections:
  - All 24 verified active Finance employees were initialised for Finance Workspace configuration and selectors.
  - Finance ticket assignment was isolated from IT support groups.
  - Finance sender-automation and task-completion monitoring foundations were added.
  - Incident and Service Request catalogues received governed `Other` entries for active workspaces.
  - Company Communications gained delivery/read/interaction monitoring foundations.

### Authoritative Finance assignment rules

- Finance Workspace assignment is direct employee ownership and must not depend on IT support groups, IT queues, IT agent acceptance, or IT SLA activation.
- All verified active Finance employees must appear in Team Administration and every Finance owner, manager, backup, reviewer and approver selector.
- A missing Finance responsibility or Primary Function record must flag configuration as incomplete; it must not hide the employee.
- Initial work-specialisation recommendations must be inferred from historical Finance ticket-assignment activity. Historical activity may rank suggestions but must never remove an eligible Finance employee.
- Historical Finance assignment activity is currently empty, so new employees must display `Work profile not established` until sufficient activity exists.
- Unassigned Finance work must be visibly flagged and included in Finance Manager correction and unattended-work queues.

### Finance email-to-ticket and presentation objective

- The immediate presentation objective is a controlled, clearly labelled demonstration using an authorised external sender address.
- The demonstration must show: incoming email, governed rule match, automatic Finance ticket creation, direct Finance owner assignment, My Work visibility, completion, documentary evidence linkage, and Finance Management completion awareness.
- Demonstration records must be excluded from ordinary operational reporting unless `Include demonstration data` is enabled.
- Production mailbox addresses, HOD addresses, delegated-task mailboxes and high-risk senders must be added later through governed configuration, never hard-coded in source.
- Important Finance emails should become tickets only when governed sender/content/risk rules match. Duplicate message and conversation identifiers must be preserved.
- Completed Finance tasks must support shared-drive or SharePoint evidence references and management notification status.

### Shared catalogue requirements

- The shared workspace catalogue architecture remains authoritative for IT, Finance, Process Engineering and future workspaces.
- Every Incident and Service Request catalogue branch must contain `Other`, opening a manual untemplated request while preserving workspace and request-type context.
- Governed catalogue administration must support add, edit, enable, disable, archive/restore, workspace applicability, required fields, evidence requirements, routing and SLA references.
- Disabled catalogue items remain available for historical records but must not appear for new requests.

### Company Communications requirements

- Company Communications must support company-wide, department, management-level, combined position-level and manually entered external audiences, including exclusions.
- Monitoring must expose intended recipients, effective recipients, delivery attempts, sent/failed/skipped outcomes, first and latest read times, acknowledgements, comments and other recorded interactions.
- Campaigns without delivery records must be visibly flagged as incomplete or not processed.
- Production remains authoritative; monitoring access must follow the signed-in account's roles and scope rather than copying all server data into a personal account.

### Current validation and environment state

- Script 895 completed backend syntax checks, frontend production build and scoped Git validation.
- Script 896 completed transactional migration, backend syntax checks, frontend production build and scoped Git validation after exact database-schema corrections.
- No deployment, commit or push was performed by Scripts 895 or 896.
- No Microsoft Directory, Microsoft Graph or SharePoint write was performed.
- Live server communication deliveries and employee interaction history require production server/database access and must be validated during the next server session.

### Next implementation and validation work

1. Validate the complete Finance Workspace locally with all 24 Finance employees visible in Team Administration and owner selectors.
2. Build and run the controlled external-email demonstration with explicit demonstration-data classification.
3. Add the Finance Manager presentation dashboard for unattended emails, open tasks, completed tasks, evidence status and management notifications.
4. Connect governed production Finance mailboxes and sender rules after approval and mailbox details are supplied.
5. Validate Company Communications against the production server database, including missing delivery generation, recipient snapshots, reads, acknowledgements, comments and interaction reporting.
6. Complete the cross-workspace Manage Services interface and verify `Other` in IT, Finance and Process Engineering request journeys.
7. Perform one consolidated milestone test only after the current milestone functions are complete, then prepare deployment, server push and consolidated milestone reporting.

## 2026-10-31 Finance/PDM major-batch implementation checkpoint
- Preflight-first execution standard is mandatory: feasibility checks complete before implementation starts; blocked checks make zero implementation changes.
- Finance and Process Engineering workspace route declarations and backend registrations were verified before changes.
- Added Finance task collaboration lifecycle foundation for assistants, reviewers, collaborators, submission/review, ratings/KPI linkage, reminder configuration and classified task communications.
- Database migration is generated but not executed locally by this implementation script; production DB execution requires its own schema/transaction/backup preflight.
- Backend syntax and frontend production build passed after implementation.
- Next work: connect UI controls and dashboards to the tasking APIs, then guarded DB migration/deployment and runtime Finance/PDM 404 validation.
## 2026-11-01 Finance/PDM UI continuation completed
- Finance participant/submission/review API client methods wired.
- Finance task monitoring added for ownership, due dates, evidence, review, acknowledgement and KPI linkage.
- PDM shared task surface inserted using a source-aware verified render boundary.
- Both preflight and post-change frontend builds passed. Next: interactive task tables, reminders, evidence permissions, classified communication and guarded UI production deployment.

## 2026-11-01 Finance work-control continuation
- Added due/reminder controls, classified Finance task communications, participant visibility/edit permissions and consolidated task-control API.
- Added Finance frontend API methods and dashboard guidance for assignment, reminders, communication and visibility.
- Preflight/backend syntax/frontend build/post-change validation passed.
- Next: production migration/API/UI deployment, interactive employee/manager drill-down tables and morning Finance reminder scheduling.

## 2026-11-01 Weekly milestone transfer and reporting foundation
- Completed task entries are transferred by copy/linkage into ATD_HELPDESK_MILESTONE_TRACKER.md/.json/.csv; original task history is preserved.
- Milestones are grouped by week and include project, workstream, completion date, source, environment and production server scope.
- JSON/CSV are reusable for Helpdesk reporting and preview-first Excel export.
- Morning reminder enhancement queued as implementation priority: split New (<7 days) and Older (>=7 days), with due today, overdue, due soon, awaiting review and assignment counts.

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


## 2026-11-07 closeout update
- Preflight 975 PASS: backend DB and Node checks healthy. 166 unresolved tickets; 157 older than 21 days; 9 created in latest 7 days.
- Closeout goals: Finance 403 cleanup, Finance dual IT/Finance workspace access, Finance management/KPI/email rules, long-range Ticket Monitor statistics, Ticket Workspace two-axis scroll, governed Monitor drag/drop, recurring branded communications, 08:00 grouped aging digest, project/agent contribution reporting and deployment validation.
- Script 977 applies only low-risk UI changes and build validation. It does not deploy or mutate DB. Remaining backend/statistics/scheduler work must preserve ticket lifecycle, SLA, assignment, notifications and audit.
- Continuity rule: preserve working tree and per-script backups; never reset unrelated modified files.


## 2026-11-07 final pre-deployment closeout checkpoint
- Script 975 preflight PASS: DB and Node route checks healthy. 166 unresolved tickets; 157 >21 days; 9 created in latest 7 days.
- Script 977 PASS: Finance 403 cleanup, Finance Team dashboard mode, Finance Email Intake Settings, Ticket Workspace two-axis scrolling, tracker continuity; frontend production build passed.
- Script 978 applies only idempotent current-state UI closeout safeguards and production build validation.
- Deployment blockers that MUST NOT be guessed immediately before deployment: recurring company communications schema/scheduler; governed 08:00 aging digest sender; Ticket Monitor governed drag/drop lifecycle mutation; deep year/month/day/agent statistics endpoint; auditable project contribution endpoint. These require their exact current backend write contracts and regression tests.
- Required deployment smoke: create Incident, Service Request, Asset Request; Major Incident Critical SLA; open employee ticket; Finance staff choose IT or Finance; Finance email intake/rules; Ticket Workspace scrolling; Ticket Monitor filters; communications immediate send; notifications; attachments; assignment acceptance.
- Deployment status remains NOT DEPLOYED until smoke suite passes. Preserve modified working tree and per-script backups; do not whole-file git reset.


## 2026-11-07 20:50 Production deployment checkpoint
- Script: 979 production frontend deployment.
- Status: DEPLOYMENT_FAILED.
- Detail: DEPLOY_FRONTEND failed with exit code 1
- Source validation: Script 978 PASS, frontend production build PASS, backend syntax checks PASS.
- Deployment scope: frontend dist only to /var/www/helpdesk and /var/www/production. Backend source/services are NOT changed by this script.
- Continuity: preserve modified working tree and per-script backups; verify production smoke tests before declaring deployment closed.


## 2026-11-07 20:54 Production deployment checkpoint
- Script: 979 production frontend deployment.
- Status: DEPLOYMENT_FAILED.
- Detail: VALIDATE_ACTIVATION failed with exit code 2
- Source validation: Script 978 PASS, frontend production build PASS, backend syntax checks PASS.
- Deployment scope: frontend dist only to /var/www/helpdesk and /var/www/production. Backend source/services are NOT changed by this script.
- Continuity: preserve modified working tree and per-script backups; verify production smoke tests before declaring deployment closed.


## 2026-11-07 20:59 Production deployment checkpoint
- Script: 979 production frontend deployment.
- Status: DEPLOYED_FRONTEND.
- Detail: Bundle index-DJ6jfblV.js deployed to /var/www/helpdesk and /var/www/production with remote SHA-256 validation and rollback protection. Backend was not deployed by Script 979.
- Source validation: Script 978 PASS, frontend production build PASS, backend syntax checks PASS.
- Deployment scope: frontend dist only to /var/www/helpdesk and /var/www/production. Backend source/services are NOT changed by this script.
- Continuity: preserve modified working tree and per-script backups; verify production smoke tests before declaring deployment closed.


## 2026-11-07 22:20 Finance + IT workspace scan checkpoint
- Script: 981 full Finance/IT workspace scan.
- Status: READ-ONLY scan completed; no application/database writes.
- Context: Production frontend deployment 979 V3 passed; backend parity and authenticated Finance endpoint failures remain under investigation.
- Finance reference baseline: 33-page Finance Workspace dashboard pack includes Journal Approvals, Reconciliation Approvals, Audit Management, Monthly KPI Review, SharePoint Evidence, Notifications, Access Requests, Team Administration, Email Intake Settings, System Administration and User Manual flows.
- Result/report: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\reports\script_981_finance_it_workspace_full_scan_20261107_221814.txt | FAILED: Exception calling "AppendAllText" with "3" argument(s): "The process cannot access the file 'C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\reports\script_981_finance_it_workspace_full_scan_20261107_221814.txt' because it is being used by another process."
- Continuity: inspect Script 981 report before any Finance/IT change or backend deployment. Preserve current working tree and per-script backups.


## 2026-11-07 Workspace ticket isolation checkpoint
- Problem: Finance workspace tickets were visible in the IT Ticket Workspace.
- Script 983: scopes IT Ticket Workspace list requests to workspace IT and reinforces backend list filtering when a workspace filter is supplied; ticket detail authorization remains unchanged.
- Validation: backend Node syntax PASS; frontend production build PASS.
- Deployment: NOT DEPLOYED by Script 983. Backend + frontend parity deployment and role smoke tests still required.


## 2026-11-08 Sidebar syntax recovery v3
- Root cause: failed Finance navigation injection split the identifier operationsItems into operationsI + tems around the injected JSX. Removing only JSX exposed the second syntax defect.
- Script 984 emergency v3 removes the exact malformed Finance button and rejoins the exact governedOperationsItems expression.
- Validation requires frontend production build PASS. Finance navigation restoration remains a separate change after source is clean.


## 2026-11-08 00:53 Script 985 V4 deployment checkpoint
- Status: DEPLOYMENT_FAILED.
- Detail: DEPLOY failed exit=1
- V4 packaging is allow-listed: frontend dist + backend src/package manifests only; local backend node_modules/.env/uploads/backups are never staged.
- Deployment uses remote candidate syntax/hash preflight, full frontend/backend backup, process restart, route smoke tests and automatic rollback on activation failure.


## 2026-11-09 13:35 Regression workflow + encoding scan
- Script 987 performed a read-only regression scan after later-conversation changes were suspected of undoing previously resolved workflows.
- Current user-visible regressions: Service Catalog cannot resolve IT managed workspace; Incident creation says selected managed catalogue item is not valid; mojibake/encoding artifacts are visible in UI.
- Report: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\reports\script_987_regression_workflow_encoding_scan_v2_20261109_133253.txt
- No application/database writes were made by this scan. Use report before repairs; preserve successful workspace isolation, Finance separation, Major Incident, asset catalogue and employee ticket access behavior.


## 2026-11-09 Managed catalogue regression recovery
- Script 987 V2 PASS identified 84 suspicious mojibake lines and confirmed local DB/API syntax health.
- Script 988 restores governed IT workspace eligibility for request-options, service catalogue managed-source identity, normalized selected managed IDs, and cleans only confirmed punctuation mojibake in active affected source files.
- Preserved: Finance/IT queue isolation, Major Incident Critical behavior, Asset catalogue, assignment acceptance, ticket access and Finance governance.
- Validation: backend syntax + frontend production build required before success. Deployment remains separate.


## 2026-11-09 Incident summary/catalogue UX linkage
- Script 989 moves Common Issues directly below Short Summary and links managed Category/Sub-category/Item selection to a classification-derived Short Summary.
- Summary precedence: managed default_summary, managed item_name, selected item, selected sub-category, selected category.
- Manual title edits are preserved unless the title is blank, still equals the previous classification-derived value, is governed/locked, or equals the initial prefill.
- Script 988 catalogue/encoding repair remained build-clean before this change.


## 2026-11-09 TicketCreate initialization-order hotfix
- Script 989 introduced incidentSuggestedSummary before resolvedWorkspaceCatalogueItem was initialized, causing runtime ReferenceError at TicketCreatePage.jsx around line 439 despite the production build succeeding.
- Script 990 moves the summary memo below resolvedWorkspaceCatalogueItem and preserves the Common Issues/Short Summary linkage.
- Validation: frontend production build required; database/backend unchanged.


## 2026-11-09 17:32 IT ticket-creation contract verification
- Script 992 V2 validates the full IT create chain: routes, managed catalogue identity, Short Summary linkage, SLA/priority, requester identity, assignment proposal/acceptance, attachments, duplicate protection, submission payload, DB catalogue, local HTTP and production build.
- It is read-only apart from this continuity entry. Report: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\reports\script_992_it_ticket_creation_contract_verification_v2_20261109_173206.txt


## 2026-11-09 IT managed catalogue runtime repair
- Script 992 V2 PASS confirmed IT workspace UUID 68602ff0-718b-476b-b61d-b6488a72ad11 remains draft, with 44 active incident and 76 active service_request catalogue items, and ERP/Infrastructure support groups available.
- Regression found: TicketCreatePage and RequestCatalogPage had reintroduced frontend workspacesApi directory resolution before request-options; employee visibility can return no managed workspace and block valid catalogues.
- Script 993 makes both flows call the authenticated server-side request-options alias resolver directly and preserves managedCatalogueItemId resolution, Major Incident, assignment, attachments, duplicates and IT/Finance queue isolation.
- Validation: production frontend build required. Database unchanged.


## 2026-11-09 Canonical IT workflow recovery 996A
- Canonical source: Helpdesk Ticket workflow.pdf.
- Restored server-side managed workspace alias loading for Incident/Service/Asset catalogue access; removed employee-side abort on missing browser workspace directory resolution.
- Preserved managedCatalogueItemId, Category/Sub-category/Item, governed Short Summary, Major Incident Critical SLA, assignment proposal/Accept and Action, attachments, duplicate protection and IT/Finance queue isolation.
- Added requester 7-day reopen enforcement for Resolved/Closed tickets while retaining resolution-cycle history. 30-day operational expiry remains archive/reporting configuration work, not physical deletion.
- Cleaned confirmed TicketCreate/RequestCatalog mojibake punctuation. Backend syntax and production frontend build required before success.


## 2026-11-09 Service/Asset catalogue stabilization 998
- User-visible defect: Request a Service and Request an Asset remained indefinitely on Loading catalog after canonical IT recovery.
- Script 998 requires a clean baseline build before modification, reuses the existing managed /catalog/services endpoint to avoid client workspace-directory/alias dependencies, preserves managedCatalogueItemId, and adds a 15-second fail-visible loading guard.
- The current RequestCatalog mapper receives a normalized managed-item shape, so Service and Asset filtering continue from the same authoritative IT service_request catalogue.
- No database writes. Post-change production build required. Helpdesk Ticket workflow.pdf remains the canonical UX acceptance reference.


## 2026-11-09 Managed catalogue exact-source repair 999 V4
- Manual source inspection established catalogApi currently exposes getService (singular), getAssets and getFields, while RequestCatalogPage contains exactly one catalogApi.getServices() call introduced by Script 998. Earlier 999 preflights correctly stopped because they assumed a getServices helper existed in api.js.
- V4 adds getManagedItServices adjacent to the confirmed getService entry; adds a bounded direct DB endpoint; changes only the one RequestCatalog call token while preserving Script 998 mapping/loading guards.
- Baseline build, backend syntax and post-change build required. No DB writes.


## 2026-11-09 21:54 Local backend/catalogue runtime recovery
- Screenshot showed Vite ECONNREFUSED for /api/terms/current and /api/auth/me, proving port 3001 API was unavailable; this explains Service/Asset catalogue loading independently of frontend catalogue code.
- Script 1000 verifies server syntax, PostgreSQL connectivity, managed IT service item count, starts backend directly via node src/server.js when port 3001 is not listening, and probes protected/catalogue endpoints.
- No source or database writes. Runtime logs: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\reports\script_1000_backend_runtime_20261109_215453.log and C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\reports\script_1000_backend_runtime_20261109_215453.err.log


## 2026-11-09 RequestCatalog baseline recovery 1002
- Script 1001 v1 introduced an invalid finally block around RequestCatalogPage.jsx line 155. Although its report said rollback, the malformed marker remained in the live working file and caused Script 1001 v2 baseline build to fail.
- Script 1002 removes only the exact SCRIPT_1001_FINALLY insertion and requires a full production frontend build before retaining the change.
- No catalogue logic, backend or database behavior changed. This restores a clean baseline before any authenticated-loader change.


## 2026-11-09 22:34 RequestCatalog exact runtime preflight 1005
- Script 1004 baseline build passed and proved getManagedItServices helper and call already exist; its own PowerShell path variable was overwritten by a case-insensitive $r result variable, causing ReadAllText to receive a PSCustomObject. Script 1004 rolled back.
- Script 1005 V2 is read-only, uses distinct descriptive variable names, captures exact RequestCatalog/API/backend loader source and authoritative DB Asset branch distribution before any further implementation.
- Report: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\reports\script_1005_requestcatalog_exact_runtime_preflight_v2_20261109_223420.txt


## 2026-11-09 Service/Asset catalogue final filtering repair 1006
- Script 1005 V2 PASS proved current wiring is correct: getManagedItServices helper=1, RequestCatalog managed call=1, managed backend route=1, baseline build PASS.
- Database truth: 76 active IT service_request records; 11 Asset records. Asset rows are category Hardware /Equipment with sub-categories Asset Provisioning, Asset Maintenance, Asset Repair, Asset Replacement and Asset Lifecycle.
- Script 1006 replaces only RequestCatalog's managedItems filter/map block. Service shows all 76 managed items; Asset shows only Hardware /Equipment rows whose sub-category starts with Asset. managedCatalogueItemId is explicitly preserved.
- Baseline and post-change production builds required. No backend/database changes. IT should be frozen after authenticated Service/Asset acceptance.


## 2026-11-09 RequestCatalog stale workspace gate removal 1007
- Script 1005 V2 proved 76 managed service_request rows and 11 Asset rows, plus correct getManagedItServices helper/call/backend route.
- Script 1006 corrected Asset filtering and passed baseline/post builds, but the UI still showed 0 items.
- Root cause retained in RequestCatalog: before catalogApi.getManagedItServices executes, an obsolete if (!managedWorkspace?.id) branch clears items/categories, ends loading and returns. This reproduces the original employee workspace-directory dependency even though the new server endpoint resolves IT directly.
- Script 1007 V2 removes only that exact early-return gate. It preserves the direct managed endpoint, 76/11 authoritative data, Script 1006 filter, loading timeout, managedCatalogueItemId, and all IT/Finance isolation.
- Baseline and post-change production builds required. No DB/backend writes.


## 2026-11-09 22:56 IT + Finance predeployment gate 1008
- Script 1007 V2 passed: obsolete employee managedWorkspace early-return removed; frontend baseline/post-build passed; Service/Asset authoritative managed catalogue path may now execute for employee accounts.
- Script 1008 validates backend syntax, production frontend build, catalogue counts, Asset count, ticket workspace distribution, Finance responsibility baseline, IT workspace isolation, Finance route and Major Incident Critical marker before deployment.
- Deployment still requires authenticated production smoke after transfer.


## 2026-11-09 Service catalogue generic Other-card cleanup 1010
- User acceptance showed the managed Service Catalogue now loads successfully for the employee flow, but multiple generic 'Other' manual-request cards are repeated across catalogue branches.
- Script 1010 removes generic Other/is_other records from employee Service and Asset catalogue card lists only. Catalogue Manager/manual administration data remains unchanged in PostgreSQL.
- Existing real service items, direct managed endpoint, Script 1006 Asset filter, Script 1007 employee gate removal and managedCatalogueItemId are preserved.
- Baseline and post-change frontend production builds required. No database/backend writes.


## 2026-11-09 23:12 IT + Finance production deployment 1009
- Status: FAILED.
- Detail: DEPLOY_IT_FINANCE failed exit=1
- Predeployment baseline: Script 1007 V2 PASS removed obsolete employee workspace-directory gate; authoritative Service/Asset catalogue path retained. Script 1005 V2 proved 76 Service Request records / 11 Asset records. Finance preflight 994 established Finance responsibilities/KPI/approval foundation.
- Deployment package is allow-listed frontend dist + backend src/package manifests. Production .env/uploads are preserved. Database migrations are NOT executed by this script.
- Production backend is supervised by pm2-atdadmin.service and runs /var/www/atd-helpdesk/backend/src/server.js on 127.0.0.1:3001.
- After deployment run authenticated IT and Finance acceptance before freezing workspaces.


## 2026-11-09 23:14 IT + Finance predeployment gate 1008
- Script 1007 V2 passed: obsolete employee managedWorkspace early-return removed; frontend baseline/post-build passed; Service/Asset authoritative managed catalogue path may now execute for employee accounts.
- Script 1008 validates backend syntax, production frontend build, catalogue counts, Asset count, ticket workspace distribution, Finance responsibility baseline, IT workspace isolation, Finance route and Major Incident Critical marker before deployment.
- Deployment still requires authenticated production smoke after transfer.


## 2026-11-09 23:24 HOD deployment staging 1011
- Script 1009 passed all local/source/DB/upload/remote syntax preflights but stopped before production changes because the atddev sudo password was unavailable/incorrect. No production backup or implementation started.
- Script 1008 separately passed full IT+Finance predeployment validation: IT service_request=76, Asset=11, Finance responsibilities=24, stale catalogue gate absent, managed call present, IT isolation/Finance route/Major Incident markers present.
- Script 1010 passed and hides generic Other cards from employee Service/Asset catalogue lists.
- Script 1011 stages the CURRENT post-1010 frontend/backend payload only; HOD must activate as atdadmin using /tmp/atd1011-20261109_232203/activate-as-hod.sh. No migrations are run.


## 2026-11-10 09:01 Files-only deployment v3
- Script 1013 v2 reached implementation but cp -a failed because atddev cannot preserve www-data/root timestamps/ownership metadata; rollback completed.
- Script 1013 v3 uses ordinary cp -r / cp rather than archive-preserving cp -a, while retaining checksum/syntax validation and rollback backup. PM2 restart remains deliberately separate.
- After success, remaining activation: sudo systemctl restart pm2-atdadmin.service, then HTTP/authenticated smoke.


## 2026-11-10 09:07 PM2 restart verification 1014
- Manual restart command returned pm2-atdadmin.service active, but immediate pgrep for /var/www/atd-helpdesk/backend/src/server.js produced no visible process output. Service-active only proves the PM2 daemon is running, not necessarily the Helpdesk application.
- Script 1014 captures systemd status, atdadmin PM2 list/dump, port 3001, journal and unauthenticated API smoke before any further activation action.
- Report: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\reports\script_1014_post_pm2_restart_diagnostic_20261110_090719.txt


## 2026-11-10 09:48 Backend runtime root-cause preflight 1018
- Scripts 1016/1017 restored production backend/server.js and npm dependencies, but PM2 atd-helpdesk-api still returned 503 and historical PM2 logs continued showing MODULE_NOT_FOUND for server.js.
- Script 1018 is read-only except for a bounded 12-second direct Node startup probe. It verifies filesystem traversal/readability as atdadmin, Node syntax/module resolution, current PM2 error tail and captures fresh direct-start stdout/stderr to distinguish stale logs from the current startup blocker.
- Report: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\reports\script_1018_backend_runtime_root_cause_preflight_20261110_094800.txt


## 2026-11-10 09:55 Production backend permission recovery 1019 V2
- Script 1019 V1 made no production change because SSH executed its inline shell under /bin/sh and rejected set -o pipefail immediately.
- V2 uploads the exact recovery commands as an LF-only Bash script, validates bash -n remotely, then executes explicitly with bash.
- Root cause remains Script 1018 finding: backend/src exists but is drwx------ atddev:atddev, preventing PM2 owner atdadmin from traversing src and making server.js appear MODULE_NOT_FOUND.
- V2 normalizes source group/permissions, verifies atdadmin source access, targeted-restarts atd-helpdesk-api and requires port 3001 plus tickets/catalog/Finance APIs at 200/401/403.
- Report: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\reports\script_1019_fix_backend_permissions_pm2_20261110_095514.txt


## 2026-11-10 10:00 Production frontend activation 1020 V2
- Script 1019 V2 PASS recovered backend runtime by normalizing backend/src permissions for atdadmin, targeted-restarting atd-helpdesk-api, restoring port 3001, and returning 401 on tickets/catalog/Finance protected APIs.
- Script 1020 V2 activates only the validated staged frontend into /var/www/helpdesk and /var/www/production. Backend is preflighted healthy and is not modified/restarted.
- Frontend backup and checksum validation are mandatory; Service, Asset and Finance page routes are smoke-tested.
- Report: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\reports\script_1020_frontend_only_production_activation_v2_20261110_100040.txt


## 2026-11-10 Incident catalogue/category cleanup 1023
- Script 1022 PASS confirmed authoritative IT incident catalogue has multiple categories/subcategories (Application Software, Hardware /Equipment, Network, Office Applications, Other, Security) while production UI showed one/insufficient category and visible mojibake.
- Script 1023 keeps the DB-driven CategoryCascade but makes category extraction accept canonical/raw mapped category fields and rewrites known visible priority/knowledge/attachment guidance to ASCII-safe wording.
- Helpdesk Ticket workflow.pdf remains canonical: quick Incident/Service selection should drive managed item and lock related Category/Short Summary; expanded catalogue remains available.
- Baseline and post-change frontend builds required; no DB/backend writes.


## 2026-11-12 10:38 IT / Finance ticket workspace isolation preflight 1025
- Requirement reaffirmed: IT Ticket Workspace and Finance Workspace ticket queues must remain separate while Finance employees may retain ordinary Helpdesk access.
- Script 1025 records frontend/backend workspace-filter evidence and DB ticket counts without changing source/data. Canonical PDF workflow changes must preserve explicit IT filtering and Finance backend scope.
- Report: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\reports\script_1025_it_finance_workspace_isolation_preflight_20261112_103831.txt


## 2026-11-12 11:18 Queued Catalogue Manager + canonical workflow batches 1026
- Reference UX: Helpdesk Ticket workflow.pdf plus current Service Catalog page visual pattern (left category navigation, search, responsive managed-item cards, Catalogue Manager administrative entry).
- 1027 P0: canonical request entry/Incident/Service flow; true blank Other; governed managed item locks; beneficiary picker; mojibake cleanup. Preserve IT/Finance isolation.
- 1028 P0: managed catalogue fast path/cache shared by Service and Asset; one authenticated fetch per short TTL/session; non-blocking quick cards; invalidate on manager mutations.
- 1029 P1: simplify Catalogue Manager around a workspace-first selector and immediate item inventory. Managers see and create items for their authorised workspace; editing/reorder/archive/duplicate remain governed.
- 1030 P1: authorization. Workspace managers are scoped to authorised department/workspace. Superadmin receives All Workspaces and can switch across IT, Finance, PDM, Production, Facilities, HR and other configured service_workspaces. Backend permission checks remain authoritative.
- 1031 P1: Catalogue Manager-to-employee catalogue parity and cache invalidation after create/update/status/reorder operations.
- 1032 P0 regression: IT Ticket Workspace stays workspace=IT; Finance queue stays Finance-scoped; access rights do not merge operational queues.
- 1033: resume Finance employee/manager dashboards, approval routing, evidence, timeliness/quality scoring and KPI periods after IT acceptance.
- No application or DB changes in Script 1026. Report: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\reports\script_1026_catalogue_manager_batch_queue_20261112_111822.txt

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


## 2026-11-12 12:46 GitHub continuation checkpoint
- GitHub remote: https://github.com/lethaboJr21/atd-helpdesk-system.git
- Branch: feature/launch-communications-queue-compatibility
- Commit pushed: fb042dd5f228982c10b1d9add8235b60500c1ef9
- Continuation prompt: docs/ATD_HELPDESK_NEW_CONVERSATION_CONTINUATION_PROMPT.md
- Two active delivery batches remain: Batch A canonical Helpdesk workflow/catalogue platform; Batch B Finance dashboards/approval/KPI governance.
- Note: this tracker entry is created after remote verification and should be included in the next implementation commit.


## 2026-11-12 12:50 Finance acceleration preflight 1032
- GitHub continuation checkpoint was successfully pushed and remotely verified at fb042dd5f228982c10b1d9add8235b60500c1ef9 on feature/launch-communications-queue-compatibility.
- Finance acceleration now inventories existing Employee/Manager dashboard, Journals, Reconciliations, Month-End, ticket review, KPI/duty, evidence, extension, email/correspondence and access-scope capabilities before consolidating implementation.
- Finance changes must preserve IT/Finance ticket isolation and ordinary Helpdesk access for Finance employees.
- Report: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\reports\script_1032_finance_acceleration_preflight_20261112_125045.txt


## 2026-11-14 16:14 Finance B1 employee dashboard/access implementation 1035
- Added direct assigned Finance ticket visibility for active Finance-responsibility users in generic ticket access, preserving requester/creator/participant/operations paths and Finance workspace isolation.
- Added Finance /my-work endpoint for directly assigned Finance tickets plus owned Month-End tasks with overdue, 24h, 50%-elapsed, returned and awaiting-review metrics.
- Replaced Finance My Work ticket-only table with FinanceEmployeeDashboard showing task risk/time elapsed and Month-End evidence context.
- Assignment email notifications already exist on Finance delegation via createTicketAssignmentNotifications. 50%-elapsed/24-hour server-side email scheduler remains the next Finance implementation slice because delivery must use the existing email service idempotently rather than repurpose the assignment template.
- Validation: backend syntax + frontend production build required. No DB migration in this slice.

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

## 2026-11-14 16:38 Finance reminder scheduler implementation 1038
- Added server-side Finance task reminder service using existing node-cron and services/email sendEmail (Microsoft Graph when configured).
- Finance assignment now sends a dedicated assignment email in addition to existing in-app createTicketAssignmentNotifications.
- Scheduler runs every 10 minutes, sends idempotent 50%-elapsed and <=24h reminders against current assignee/due date, records delivery via finance_task_reminders.last_sent_at, skips completed states, and avoids 24h burst for tasks whose entire assignment window is <=24h.
- Reminder link points directly to assigned Finance ticket. Delivery failures remain unsent so scheduler may retry and are logged operationally.
- Existing finance_task_reminders unique(ticket_id,user_id,reminder_type) is reused; no schema migration required.
- Validation: backend Node syntax + full frontend production build passed. IT/Finance queue isolation unchanged.

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

## Script 1034 fixed-v3 checkpoint - 20261121_230947
- Promoted advanced FinanceTeamDirectory to primary Team Administration when source anchor matched.
- Conservative mojibake cleanup used code-point mappings; no blind transcoding.
- Applied 2026-11-20-finance-kpi-link-schema-compatibility.sql through runMigration.js.
- Preserved Finance versus IT workspace isolation and shared ticket business logic.
- Finance-native Ticket Detail remains required before deployment if current route remains generic.
- Backup: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\Batch backups\script-1034-20261121_230947



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



## Script 1039 checkpoint - 20261122_003923
- Added real Graph-backed Finance SharePoint evidence service and metadata schema.
- Added Finance evidence upload/list endpoints and SharePoint links in governance + Finance ticket detail.
- Finance correspondence now exposes Open Email and Mark as Ticket while preserving idempotent conversion and Finance-native ticket routing.
- Existing Graph delta mailbox monitor and sender automation architecture preserved.
- Real site/drive remain environment-configured via FINANCE_SHAREPOINT_SITE_ID / FINANCE_SHAREPOINT_DRIVE_ID.
- Backup: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\Batch backups\script-1039-20261122_003923



## Emergency recovery 1054 - 20261123_094547
- Employee Incident and Service Request submission aligned with governed support-group queue; no mandatory employee-selected agent.
- Operations users retain proposed-assignee workflow.
- Restored workspaceQueryService as required backend dependency in production package.
- Targeted TicketCreate mojibake repaired in change workflow strings.
- Production deployment remains changed-files-only with server backup before overwrite.
- Local backup: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk\Batch backups\script-1054-20261123_094547


## 2026-11-23 - Employee catalogue ticket recovery
- Incident and Service Request submissions now default to the governed support-group queue.
- Employees no longer need to select an individual IT agent.
- IT operations can still explicitly propose an assignee.
- Updated Incident guidance to describe support-group routing and agent acceptance.
- Production catalogue-category mapping migration had already been restored.


## 2026-11-23 - Incident catalogue and optional agent recovery
- Restored the live Incident catalogue from the validated local managed Incident catalogue.
- Agent selection is optional for employees. Choosing an agent proposes that agent; leaving it blank uses the support-group queue.
- Service Request and Incident routing continue to use managed catalogue IDs.
- Production rows are backed up before catalogue synchronization.


## 2026-11-23 - Final optional Agent selector recovery
- Preferred IT Agent dropdown is now visible on auto-routed Incident and Service Request forms.
- Blank selection uses the support-group queue; selecting an eligible agent uses proposed-assignee routing.
- Production Incident catalogue remains 25 active unique items with one canonical Other.


## 2026-11-24 - Employee form final repair v2
- Preferred Agent selector retained for auto-routed tickets.
- Employee Impact and Urgency are disabled and calculated from Priority.
- Backend canonicalizes employee Impact and Urgency from governed Priority.

