# ATD Helpdesk New Conversation Context

Give this file to a new conversation before requesting ATD Helpdesk work. Treat current repository source and generated validation reports as the source of truth. Tracker statements describe intent and continuity, but do not prove implementation.

## Working method

1. Continue numbered PowerShell scripts under `scripts` from the latest script number.
2. Run every script from the repository root.
3. Use Notepad-friendly UTF-8 TXT reports and provide the exact run command.
4. Before risky edits, collect complete current files and dependencies.
5. Validate exact SHA-256 baselines, back up complete targets, use minimally invasive changes, verify markers, and automatically roll back on failure.
6. Preserve working functionality. Do not overwrite source drift or modify hashes to force a patch.
7. Do not perform database, Git, server, restart, email, or deployment actions unless the current step explicitly schedules them.
8. Keep email and background jobs disabled during controlled development unless a governed test explicitly requires them.
9. Implement related features in coherent four-function groups.
10. Defer broad testing until the milestone boundary, then run one comprehensive milestone validation, curated commit and server deployment, followed by one consolidated report and README update.

## Current repository position

- Branch recorded at the Script 452 checkpoint: `feature/launch-communications-queue-compatibility`.
- Baseline recorded at the Script 452 checkpoint: `120e91a47d584ac25a250ee18689389624e2fa7c`.
- The working tree contains many intentional modified and untracked files. Never package or reset the dirty tree indiscriminately.
- Administration Settings full-width layout, one internal scrollbar, sticky header, compact cards, and sticky communication actions are implemented locally and await milestone validation.
- Governed communication drafts, branded templates, send/schedule dialogs, lifecycle tabs, and delivery history are implemented locally.
- Announcement attachments, expanded audiences, Dashboard publication, and conversations remain the active communications group.
- Ticket Workspace adaptive right panels, Statistics, login metrics, and Monday reports are scheduled after deployment and Email-to-Ticket repair.

## Company Communications audience contract

Audience resolution is server-authoritative and uses inclusive groups followed by exclusions. The interface uses checkboxes and searchable selectors.

### Include checkboxes

- Whole company
- Departments
- Managers
- Heads of Department
- Positions or job titles
- Specific employees
- Support groups
- Workspace members

### Other options

- Additional external email recipients
- Exclude Managers
- Exclude Heads of Department
- Exclude selected Departments
- Exclude selected Positions
- Exclude selected employees
- Exclude selected Support groups
- Exclude selected Workspace members

### Required examples

- Whole company except Managers and HODs.
- Whole company except selected people, plus approved additional email recipients.
- Selected Departments plus Managers, excluding selected employees.
- Selected Support groups plus Workspace members.

### Resolution rules

1. Resolve all included internal users who are approved, active person accounts, not archived or deactivated, and Microsoft-enabled.
2. Deduplicate internal recipients by user ID and normalized email.
3. Apply all exclusions after all inclusions.
4. Validate external addresses separately and label them as external.
5. Never infer HOD status from a person's name. Prefer governed position metadata or an explicit future HOD entitlement.
6. Display final recipient count, Departments, positions, internal/external split, and exclusions before approval.
7. Save the normalized audience definition and recipient snapshot used for delivery evidence.
8. Dashboard visibility uses the same resolved internal audience and never exposes a restricted communication.

## Security review sequence to discuss before implementation

1. Session lifecycle: secure cookie versus bearer-token strategy, inactivity timeout, absolute lifetime, renewal, logout revocation, concurrent sessions, and Microsoft sign-out behaviour.
2. Authentication event storage: successful and failed event separation, privacy-safe device and IP evidence, duplicate-session handling, retention, and weekly-report eligibility.
3. Authorization: route-level role checks, object-level access, Department and Workspace scope, least privilege, and self-approval prevention.
4. CSRF, CORS, content security policy, rate limiting, upload validation, malware-scanning integration point, path confinement, and safe download headers.
5. Secrets and operational security: environment-variable ownership, token-cache controls, log redaction, audit immutability, database permissions, backups, recovery, alerts, and incident response.

## Required continuity files

- `docs/ATD_HELPDESK_NEW_CONVERSATION_CONTEXT.md`: portable new-conversation briefing.
- `docs/ATD_HELPDESK_DEVELOPMENT_TRACKER.md`: milestone and task status.
- `docs/ATD_HELPDESK_CAPABILITY_REGISTER.md`: implementation status by capability.
- `docs/ATD_HELPDESK_GOVERNANCE_AND_HANDOFF.md`: safety and governance rules.

## Immediate next implementation

Use the Script 452 source checkpoint to implement the communications group without sending email: audience metadata and checkbox UI; authoritative include/exclude resolution; attachment persistence and authenticated download; Dashboard publication and audience-restricted conversations. Add additive migration files but do not execute them until the controlled milestone migration step.

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
## Current development-window rules

- Use exact current source before changing communication storage or email-provider contracts.
- Create no more than three upload-ready TXT reports; one is preferred for this batch.
- Do not execute pending migrations during local development.
- Do not send test or live Company Communications unless a later governed validation step explicitly authorizes a non-production recipient.
- Stage only explicit curated files and push only to the github remote during this window.
- Keep atddev filesystem deployment and atdadmin PM2 runtime duties deferred to the later server window.
- Attachment storage must use randomized names, confined paths, validated content types and sizes, and authenticated downloads.
- Provider integration must record attachment validation or provider failure without silently dropping attachments.
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
## Script 459 announcement visibility governance

- Dashboard visibility, attachment authorization, read state, and conversations must use one server-authoritative audience decision.
- The frontend must not infer audience membership.
- Comments must not disclose recipients or content to people outside the communication audience.
- Read state must remain independent from comment, acknowledgement, and attachment actions.
- Managers may moderate only where a later governed Department or Workspace scope proves authority; Superadministrators retain platform moderation.
- No live message may be sent during this implementation batch.
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
## Onboarding and render-safety rules

- Onboarding enforcement must be server-authoritative and fail closed for protected employee functions.
- Avatar upload is optional and must never block onboarding completion.
- Non-person, archived, deactivated, service, generic, automation, and external accounts must not be forced through employee onboarding.
- Do not set React state during another component's render. State synchronization belongs in event handlers or effects.
- Preserve existing profile-media authorization and do not expose physical storage paths.
- Do not execute onboarding migrations or change production enforcement settings during local development.
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
## Ticket archive governance rules

- Archive is a recoverable lifecycle state, not immediate deletion.
- Seven days is a grace and review threshold, not an unattended deletion trigger.
- Agents cannot permanently delete tickets and may archive only tickets assigned to themselves.
- Managers require proven Department, Support Group, or Workspace scope for restore authority.
- Superadministrator permanent deletion requires a reason, typed confirmation, audit evidence, and preservation of an appropriate tombstone where supported.
- Archived-ticket access must use the same object-level ticket authorization as active tickets.
- The current-ticket lifecycle must not be mixed with Freshservice import archive records.
<!-- ATD-SCRIPT-469-TICKET-ARCHIVE-END -->

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

## Model-ready continuation context - Finance Workspace through Script 838

### Current state after Script 838
- Scripts 836 and 837 are locally complete and frontend-build validated.
- New Request uses beneficiary-first selection, includes an incident catalogue and keeps Other as a blank editable incident.
- Catalogue items are clickable, use coloured icons and can govern locked Short Summary and Priority values.
- Verified ATD employee accounts follow server-validated Microsoft SSO routing; local password entry is reserved for eligible local accounts under backend authority.
- Finance Workspace is available at `/finance-workspace` and is presented as **Finance Department** beneath **Workspaces** in Operations navigation.
- Finance Workspace already contains the local foundation for configuration, Finance employee duties, authorised mailboxes, external-sender handling, queues, prioritisation, delegation, delegation history, dashboard reporting and export contract.

### Do not assume
- Do not assume production contains the latest Finance migrations or frontend bundle.
- Do not assume live Microsoft Graph email intake is authorised or enabled.
- Do not assume confidential Finance uploads are enabled.
- Do not assume a local build validates role scope, manager hierarchy, email idempotency, Excel output or production deployment.
- Do not copy unrestricted production data into local development. Use an approved, read-only, minimised, pseudonymised reporting replica with outbound actions disabled.
- Do not hard-code future catalogue items only in the request modal. Catalogue administration must be governed, persistent and consumed by request creation.
- Do not show an SLA percentage without exposing the governing target and whether the percentage represents response or resolution time.

### Next Finance milestone gate
Perform one consolidated Finance milestone test covering access scope, employee population, mailbox controls, external senders, actionable-email conversion, unattended detection, delegation, audit evidence, structured product capture, dashboard drill-down and reviewed Excel export. After the test passes, prepare one controlled production deployment and one consolidated milestone report.

## Script 841 username-first authentication and station operators
- Server-authoritative username/email routing: implemented locally.
- Verified company-domain employees route to Microsoft SSO.
- Superadministrator and approved local identities use password authentication.
- Plant operators may request username-based station accounts without email; plant and station are compulsory and approval remains required.
- Migration created but not executed; production deployment and milestone functional testing not performed.


## Shared workspace catalogue architecture - Script 845
Workspaces is the reusable departmental framework. IT is the default template, while Finance, Process Engineering (PDM) and future departments consume the same capabilities. Categories, field types, permissions, SLA policies, routing, functions and capability definitions remain IT/developer governed. Authorised administrators manage incident and service-request items without code. Catalogue items are ticket templates. Other opens a manual untemplated ticket while preserving workspace, catalogue type, category and sub-category, and records the original Other route for later reclassification.

## 2026-10-29 Finance Workspace, Authentication, Catalogue and Communications Checkpoint

### Current continuation brief

- Authentication repair is locally complete. Company accounts use Microsoft SSO by default, non-company active local accounts use password login, and the authorised account has both methods.
- Finance Workspace direct assignment is locally isolated from IT support groups.
- All 24 verified Finance employees have Finance profile foundations and must remain visible in every Finance selector.
- Finance email automation, completion events, catalogue `Other` entries and Company Communications interaction monitoring foundations are locally implemented.
- The next conversation must begin with local runtime validation and Finance Manager demonstration preparation, not another broad implementation.
- Use a governed external-email demonstration with visible `Demonstration data` classification. Add real Finance mailboxes and sender addresses only after they are supplied and approved.
- Production Company Communications delivery and interaction records must be inspected on the server before final operational claims.

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
