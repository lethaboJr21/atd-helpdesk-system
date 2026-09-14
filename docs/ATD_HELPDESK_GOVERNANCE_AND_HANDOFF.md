# ATD Helpdesk

<!-- ATD-SCRIPT-430-HANDOFF-START -->
## Current handoff and governing rules

- Continue numbered scripts from the repository root.
- Use coherent four-function implementation groups.
- Use exact current source before modifying risky workflows.
- Tracker statements do not prove implementation; current code and validation reports do.
- Keep no more than three upload-ready TXT reports per collection.
- Back up complete targets and provide rollback.
- No database, Git, server, restart, email send, or deployment unless explicitly scheduled.
- Preserve drafts, filters, selections, previews, and dialogs during refresh.
- Never bypass Manager approval when approval is required. Use a governed fallback queue if Manager data is unavailable.
- Printer Access, Password Reset, and Wi-Fi Access are the only current catalogue approval exceptions.
- Archive grace period is seven days, but permanent deletion remains Superadministrator-governed and is not automatic.
- Read state must not remove valid notification actions.
- Full project scan and README reconciliation occur at the next milestone boundary.
<!-- ATD-SCRIPT-430-HANDOFF-END -->

<!-- ATD-SCRIPT-431-GOVERNANCE-START -->
## Script 431 governance additions

- Use View Ticket, not Open Case, for navigation to an existing ticket.
- Keep Manager approval separate from Agent assignment acceptance.
- An escalation is invalid unless it has a verified recipient or governed fallback queue.
- Read state must never remove escalation, approval or assignment actions.
- Resolved and Closed columns may be minimized but must not be omitted.
- Store column-collapse preferences per user without hiding new critical or assigned work.
- Do not infer Manager or HOD identities from display names alone.
- Do not implement automatic permanent deletion.
- Maintain no more than three upload-ready reports per source collection.
- Use direct application edits only after exact source validation; avoid recursive repair scripts.
<!-- ATD-SCRIPT-431-GOVERNANCE-END -->

<!-- ATD-SCRIPT-435-GOVERNANCE-START -->
## Script 435 handoff
- Bulk selected-ticket actions render through document.body and must remain below modals/toasts but above ordinary headers and content.
- Default ticket ordering is created_at descending unless an authorised user explicitly selects another sort.
- Predeployment requires build validation and exact curated file staging. Do not deploy the dirty working tree wholesale.
<!-- ATD-SCRIPT-435-GOVERNANCE-END -->

<!-- ATD-SCRIPT-438-COMMUNICATIONS-START -->
## Company Communications and ticket attachment governing rules

- A whole-company communication must never send directly from a draft action.
- The final in-app confirmation exposes Edit Communication, Cancel and Approve actions.
- Do not use native browser prompt or confirm for send, schedule, delete or archive decisions.
- Whole-company and targeted sends use the governed Approve, Edit Communication, and Cancel dialog without a typed confirmation phrase.
- Recipient preview must be refreshed and non-zero before send approval.
- Returning to edit preserves audience, content, template, attachments, schedule, placement and acknowledgement settings.
- Sent communications are delivery evidence and should normally be archived, not hard-deleted.
- Permanent deletion is Superadministrator-only, reasoned, typed-confirmed and audited.
- Announcement comments are limited to the authorised announcement audience.
- Do not send any communication during implementation or testing without an explicit governed send step.
- Ticket attachment previews must not bypass ticket authorization or require an automatic device download.
- Keep a separate explicit Download action for every downloadable attachment.
<!-- ATD-SCRIPT-438-COMMUNICATIONS-END -->

<!-- ATD-SCRIPT-447-COMMUNICATIONS-START -->
## Script 447 implementation rules

- Validate all tracker claims against source before changing capability status.
- Use exact current files and complete-file backups before modification.
- Produce no more than three upload reports; this checkpoint produces one.
- Do not send test or live communications automatically.
- Do not package the dirty working tree indiscriminately.
- Preserve existing campaign, delivery, audit and scheduler behaviour.
- Audience resolution must be server authoritative.
- Announcement comments must be limited to the resolved audience.
- Attachments must use authenticated routes and must not expose storage paths.
- A milestone-wide build and validation is required before commit or deployment.
<!-- ATD-SCRIPT-447-COMMUNICATIONS-END -->

<!-- ATD-SCRIPT-449-TICKET-INSIGHTS-START -->
## Ticket Insights governance
- Metrics must use authorised server scope and must not broaden ticket visibility.
- Login counts must use successful verified person-account authentication events.
- Rankings require context, reporting-window labels and minimum-volume safeguards.
- Keyword analysis must use governed normalization, stop-word removal and privacy controls.
- Weekly reports cover the previous complete Monday-to-Sunday period.
- Scheduled generation uses Africa/Johannesburg time and records audit evidence.
- Do not email reports until generation, access, attachment and delivery validation pass.
<!-- ATD-SCRIPT-449-TICKET-INSIGHTS-END -->

<!-- ATD-SCRIPT-451-RIGHT-PANEL-START -->
## Ticket Workspace right-panel governance
- Hidden, minimized, closed, or unpinned panels must not reserve empty layout space.
- Panel state changes must preserve local ticket work, filters, cross-page selection and current navigation.
- Right-panel content must use the same ticket authorization as the underlying workspace.
- Temporary panels remain open while hovered or keyboard-focused and support Escape to close.
- Panel width must be constrained so the primary ticket list remains usable.
- Responsive behaviour must not depend on hover for touch devices.
<!-- ATD-SCRIPT-451-RIGHT-PANEL-END -->

<!-- ATD-SCRIPT-453-CONTEXT-AUDIENCE-START -->
## Script 453 audience and continuity governance

- The portable context file is the first file supplied to a new conversation.
- Current source and validation reports override stale tracker assumptions.
- Communication selections use inclusive checkboxes followed by explicit exclusions.
- HOD status must not be inferred from a display name.
- Additional emails are visibly identified as external and separately validated.
- Server preview and send must use the same canonical resolver.
- No security feature is marked complete before threat review and role-based validation.
<!-- ATD-SCRIPT-453-CONTEXT-AUDIENCE-END -->

<!-- ATD-SCRIPT-454-V2-START -->
## Script 454 V2 communication-audience governance

- Preview and sending must call the same canonical resolver.
- All inclusions are resolved before exclusions are applied.
- Internal recipients must remain active, approved, non-archived person accounts with enabled Microsoft identities.
- HOD membership must not be inferred from free-text names or uncontrolled job titles.
- HOD audience requests fail closed until an authoritative mapping is configured.
- External emails remain visibly separate and require a later explicit permission and confirmation control.
- Migration creation does not authorise migration execution or production use.
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
