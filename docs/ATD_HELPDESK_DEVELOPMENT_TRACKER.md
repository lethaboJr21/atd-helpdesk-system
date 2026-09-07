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
