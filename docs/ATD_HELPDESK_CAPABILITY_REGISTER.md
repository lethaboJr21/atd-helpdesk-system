# ATD Helpdesk

<!-- ATD-SCRIPT-430-CAPABILITIES-START -->
## Capability continuity register

Status vocabulary: DEPLOYED, IMPLEMENTED LOCALLY, IN PROGRESS, PLANNED, REQUIRES SCAN.

### In progress
- Catalogue Manager approval, with three explicit exceptions.
- Today-first Ticket Monitor with Department, Agent, and date-window filtering.
- Persistent notification redesign.
- Current-ticket archive grace-period lifecycle.
- Structured activity table.
- Reply terminology standardisation.

### Planned immediately after source validation
- Whole-company new Helpdesk reminder and employee ticket-logging guide through Company Communications.

### Requires milestone scan
- Full frontend, backend, database, scheduler, integration, permission, and user-visible capability inventory.
- Reconcile this register, the Development Tracker, Governance Handoff, and Project README against current code.
<!-- ATD-SCRIPT-430-CAPABILITIES-END -->

<!-- ATD-SCRIPT-431-CAPABILITIES-START -->
## Lifecycle and escalation capability status

- Today-first Monitor: PLANNED, exact-source validation in progress.
- Minimizable lifecycle columns: PLANNED.
- Awaiting Manager Approval: PLANNED, requires catalogue approval persistence.
- Awaiting Agent Acceptance: IMPLEMENTED FOUNDATION, requires current-code verification.
- Manager and HOD escalation workflow: PLANNED.
- Escalation acknowledgement notifications: PLANNED.
- View Ticket terminology: PLANNED.
- Reply terminology: PLANNED.
- Seven-day Pending Deletion archive view: PLANNED.
- Full capability inventory: SCHEDULED AT MILESTONE BOUNDARY.

Capability status must be validated against current code before being promoted to IMPLEMENTED LOCALLY, VERIFIED or DEPLOYED.
<!-- ATD-SCRIPT-431-CAPABILITIES-END -->

<!-- ATD-SCRIPT-435-CAPABILITIES-START -->
## Script 435 capability status
- Latest-first ticket list: IMPLEMENTED LOCALLY.
- Critical, Department and Requestor filters: IMPLEMENTED LOCALLY.
- Shared selected-ticket viewport overlay: IMPLEMENTED LOCALLY.
- Announcement attachments: PLANNED.
- Themed Company Communications templates: PLANNED.
- Compulsory onboarding functional validation: IN PROGRESS.
<!-- ATD-SCRIPT-435-CAPABILITIES-END -->

<!-- ATD-SCRIPT-438-COMMUNICATIONS-START -->
## Company Communications and attachment capability status

- Whole-company confirmation dialog: IN PROGRESS.
- Department and specific-person audiences: FOUNDATION PRESENT, EXACT UI VALIDATION IN PROGRESS.
- Position, support-group and Workspace-member audiences: PLANNED.
- Dashboard announcement placement: PLANNED.
- Announcement conversations: PLANNED.
- Detailed delivery recipient history: BACKEND EVIDENCE PRESENT, UI PLANNED.
- Announcement attachments: PLANNED.
- Browse-file correction: CONFIRMED PRIORITY.
- Themed HTML and plain-text templates: PLANNED.
- Ticket image and PDF inline preview: PLANNED.
- Explicit attachment download: RETAINED.
- Draft delete and published archive: PLANNED.
- Permanent communication deletion: SUPERADMIN GOVERNANCE PLANNED.
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
## Script 447 capability checkpoint

- Announcement attachments: CURRENT BATCH.
- Browse and drag/drop shared attachment handler: CURRENT BATCH.
- Department, Manager, HOD, position and specific-person audiences: CURRENT BATCH.
- Support-group, Workspace-member, external-recipient and exclusion audiences: CURRENT BATCH.
- Dashboard announcement publication by resolved audience: CURRENT BATCH.
- Announcement conversations and moderation audit: CURRENT BATCH.
- Governed send/schedule popup and themed templates: IMPLEMENTED LOCALLY.
- Recipient-level delivery history: IMPLEMENTED LOCALLY.
- Frontend build and milestone validation: PENDING.
<!-- ATD-SCRIPT-447-COMMUNICATIONS-END -->

<!-- ATD-SCRIPT-449-TICKET-INSIGHTS-START -->
## Ticket Insights capability status
- Ticket Preview selector: FOUNDATION PRESENT; refinement scheduled.
- Ticket Statistics insight rail: PLANNED.
- Weekly Agent and Manager operational report: PLANNED.
- Monday 08:00 report generation: PLANNED.
- Daily, weekly and monthly successful-login metrics: REQUIRES AUTH EVENT STORAGE.
- Agent assignment-volume and response-duration metrics: PLANNED.
- Recurring keyword/service-topic flags: PLANNED WITH PRIVACY CONTROLS.
<!-- ATD-SCRIPT-449-TICKET-INSIGHTS-END -->

<!-- ATD-SCRIPT-451-RIGHT-PANEL-START -->
## Ticket Workspace right-panel capability
- Full-width ticket list when side panel is hidden: PLANNED.
- Ticket Preview hosted in adaptive right panel: FOUNDATION PRESENT, REFINEMENT PLANNED.
- Ticket Statistics hosted in adaptive right panel: PLANNED.
- View/Layout menu for panel visibility and pinning: PLANNED.
- Resizable pinned panel: PLANNED.
- Temporary unpinned drawer with stable hover/focus: PLANNED.
- Responsive full-width fallback: PLANNED.
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
## Development-window capability status

- Development remote: github.
- Server deployment: DEFERRED UNTIL LATER ON 12 SEPTEMBER 2026.
- Live Company Communication send during development: PROHIBITED.
- Announcement attachment persistence: CURRENT BATCH.
- Browse and drag/drop shared handler: CURRENT BATCH.
- Secure attachment listing/removal/download: CURRENT BATCH.
- SMTP and Graph attachment compatibility: CURRENT BATCH.
- Recipient-preview invalidation after audience changes: CURRENT BATCH.
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
## Onboarding and UI-quality capability status

- Global onboarding gate: SOURCE VALIDATION IN PROGRESS.
- Compulsory enforcement for incomplete employee person accounts: CURRENT BATCH.
- Optional onboarding avatar and Skip for Now: CURRENT BATCH.
- Non-person-account onboarding exclusions: CURRENT BATCH.
- AccountMenu/AdminUniversalHeader render-warning correction: CURRENT BATCH.
- Frontend milestone build and functional validation: PENDING.
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
## Ticket archive lifecycle capability status

- Ticket archive metadata foundation: DEPLOYED.
- Governed bulk archive action: DEPLOYED.
- Dedicated Active Tickets view: CURRENT BATCH.
- Dedicated Archived Tickets view: CURRENT BATCH.
- Pending Deletion grace-period view: CURRENT BATCH.
- Governed restoration: CURRENT BATCH.
- Superadministrator-only permanent deletion governance: CURRENT BATCH.
- Requester and Department archive columns: CURRENT BATCH.
- Structured archive activity: CURRENT BATCH.
- Frontend build, functional validation, curated commit, and GitHub push: PENDING.
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
