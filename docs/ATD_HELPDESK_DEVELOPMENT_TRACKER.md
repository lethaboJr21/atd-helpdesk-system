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
