# ATD Helpdesk Known Limitations and Roadmap

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-6-SCRIPT-591`


## 1. Purpose

This document separates known defects, work in progress, planned capabilities, and deferred work from completed functionality.

## 2. Urgent production defect

### Notification Centre ticket actions

**Priority:** Repair immediately after documentation.

Assignment alerts show valid-looking ticket references but Open reports: `Action not completed: This notification does not contain a valid ticket action.` The failure affects multiple alerts and creates repeated warning presentation.

Required repair areas:

- Notification action payload and reference mapping.
- Current and legacy notification compatibility.
- Safe ticket-opening fallback.
- Separation of navigation from governed pending actions.
- Backend revalidation of acceptance or rejection.
- Duplicate error-toast prevention.
- Regression testing across notification types.

## 3. In-progress communications reliability

The Company Communications batch for timeout resilience, asynchronous delivery, recipient idempotency, test/live isolation, and expanded history remains unresolved. Script 582 stopped on guarded source markers and must be completed through a safer structural patching route after the notification priority is addressed or appropriately sequenced.

## 4. Portal appearance roadmap

- Light and Dark modes.
- Glassmorphism as an optional portal theme/layout style.
- Named custom layout templates.
- Dashboard Studio integration.
- Responsive and accessible fallback styling.

Glassmorphism does not apply to email templates.

## 5. Ticket workspace roadmap

- List and Kanban workspace.
- Adaptive Ticket Preview, Statistics, and Hide Panel modes.
- Resizable or pinned panels on wide screens.
- Drawer or full-screen behaviour on smaller screens.
- Saved personal and shared views.
- Live refresh that preserves filters and drafts.
- Broader statistics and insights.

## 6. Collaboration roadmap

- Optional collaborators and employee CC picker.
- Optional support-group alerts.
- Assignee email.
- Microsoft Teams ticket-chat synchronisation.
- Complete conversation capture and timestamps.
- Requester-default replies and protected internal notes.

## 7. Ticket experience roadmap

- Agent availability.
- Detailed change confirmations.
- Resolved and closed surveys.
- Expanded attachment previews and full-screen viewing.
- Expanded audit trail.
- Reopened-ticket reporting and repeat-issue indicators.

## 8. Access and administration roadmap

- Grey out functions already available.
- Separate granted-access table with default, permission, or role source.
- Governed revocation for grants.
- Department Workspace completion.
- Default and sidebar entitlement clarity.

## 9. Reporting roadmap

Weekly reporting should run Monday at 08:00 for the previous Monday-to-Sunday period and cover assignment volumes, opening patterns, response and resolution durations, SLA performance, portal usage, recurring terms, directory changes, and agent or manager access.

## 10. Postdeployment documentation roadmap

After deployment, add the modular architecture reference, Architecture Decision Record library, function rationale records, failure-mode register, and decision playbooks.

## 11. Rebranding requirement

Preserve existing CMDB functionality and data. Rebrand labels, navigation, routes where appropriate, permission wording, dashboards, reports, notifications, and documentation after a replacement name is approved.

## 12. Status governance

A roadmap item becomes implemented only after source completion and validation. It becomes deployed only after controlled release and production verification. Update the existing dedicated tracker files without replacing their structure or history.

<!-- ATD-FORWARDING-PARTICIPATION-MILESTONE-20260927-BEGIN -->
## Forwarding and scoped participation delivery status

Implemented and validated locally on 27 September 2026:

- Ticket forwarding to employees, departments and governed external-email destinations.
- Ticket-scoped Read Only and Reply Only participation.
- Participant invitations, forwarding history, duplicate prevention, expiry and governed revocation.
- Someone else's tickets on the Employee Dashboard.
- Separate access and email-delivery outcomes.
- Read-only protection for replies and attachment uploads.
- Applied PostgreSQL schema with preserved legacy row counts.
- Comprehensive transactional milestone test with complete rollback cleanup, zero failures and zero warnings.

Remaining delivery work:

- Selectively stage only approved forwarding-participation files and hunks because shared files contain unrelated local changes.
- Commit and push the current feature branch with committed-file verification.
- Review the pushed milestone before server deployment and PM2 restart.
- Perform controlled post-deployment verification and produce one consolidated deployment report.
<!-- ATD-FORWARDING-PARTICIPATION-MILESTONE-20260927-END -->

<!-- ATD-PENDING-BATCHES-20260927-BEGIN -->
## Pending delivery programme captured on 27 September 2026

Priority order:

1. Complete selective delivery of forwarding and scoped participation.
2. Produce a reviewable Finance Workspace prototype before the Finance Manager meeting next week.
3. Repair the Notification Centre invalid ticket-action defect.
4. Implement responsive dashboards, pinned/floating panel behaviour, governed width slider and universal header placement.
5. Compact Ticket Detail actions into contextual menus while keeping People, Status/Resolve and SLA visible.
6. Enforce closed-ticket lifecycle locks and contextual reopening.
7. Complete assignee-group defaults and multi-group alert preferences, including no-alert membership.
8. Build governed escalation separately from ticket status.
9. Implement email-first M365 versus local authentication routing.
10. Add portal-wide Excel-style column filters.
11. Add per-assignment New attention, accessible pulses, browser notifications and acknowledgement reporting.
12. Continue conversation, activity, bulk operations, universal search, reopened issues, attachments, surveys, access, layouts, reporting, organisational workspaces, communications, directory governance, CMDB rebranding and post-deployment architecture.

The detailed four-function definitions remain in `ATD_HELPDESK_DEVELOPMENT_TRACKER.md` and `ATD_HELPDESK_DEVELOPMENT_TRACKER.json`.
<!-- ATD-PENDING-BATCHES-20260927-END -->

<!-- ATD-POST-MILESTONE-20260927-BEGIN -->
## Post-forwarding milestone priorities - 27 September 2026

- Forwarding and scoped participation is committed and pushed at `edf97e4876d09d6e8120377a35a39b55896e61a7`.
- Production deployment is awaiting authorised target, backup and migration-status confirmation.
- Accelerated next batch: Finance Workspace prototype for next week's Finance Manager review.
- Following batch: responsive dashboards, pinned and floating side panels, width persistence and universal non-overlapping header controls.
- Global status popup must render above all content, dismiss briefly, pause for interaction and provide governed Undo where safe.
- Resolve and Close from Ticket Detail must exit the record and navigate to the appropriate status queue.
- User-facing closure label is `Close`, not `Governed Close`.
- Standardise the former Assets/CMDB module as `Assets Management`, with `Assets` as the sidebar label, while preserving all existing data and functionality.

Detailed four-function definitions and sequencing remain in `ATD_HELPDESK_DEVELOPMENT_TRACKER.md` and `ATD_HELPDESK_DEVELOPMENT_TRACKER.json`.
<!-- ATD-POST-MILESTONE-20260927-END -->

<!-- ATD-FINANCE-COMMERCIAL-INTELLIGENCE-20260927-BEGIN -->
## Finance commercial intelligence expansion - 27 September 2026

The accelerated Finance Workspace is expanded into a secure Finance and Commercial Intelligence platform covering Finance Main and CFO Office, Accounts Payable Office and a governed Finance Boardroom.

Compulsory scope includes structured product-line capture for Rear Step Bumpers, Chassis Frames, Tailgates, Bedliners, Box Rails and Endcaps; supplier, employee, invoice, purchase-order, sales-order, payment, approval and reconciliation data; presentation-ready dashboards; point-in-time Boardroom packs; clean governed Excel exports with Data Dictionary and Export Metadata; drill-down reporting; separation of duties; field and document classification; access and export auditing; and read-only Microsoft Entra organogram mapping.

Confidential document upload remains blocked until protected storage, file validation, malware scanning, CSRF protection, retention, authenticated download and identity-security controls are configured and reviewed.

The detailed four-function implementation definition remains in the development trackers.
<!-- ATD-FINANCE-COMMERCIAL-INTELLIGENCE-20260927-END -->

<!-- ATD-FINANCE-READINESS-ROSTER-NAMING-20260927-BEGIN -->
## Finance readiness and pre-deployment status - 27 September 2026

The Finance and Commercial Intelligence prototype passed static readiness validation with zero failures. The Finance migration remains unapplied, confidential uploads remain disabled, XLSX generation awaits an approved workbook service, and Entra office/title verification remains read-only and pending.

The provisional Accounts Payable and Finance Main/CFO office rosters are recorded in the development tracker. Access must not be granted from names alone.

Pre-deployment user-facing naming is complete: `Assets`, `Assets Management`, and `Close`. Technical routes and governance remain preserved.

Next: selective staging, clean staged-tree validation, commit, push, remote verification, authorised migration review and controlled deployment.
<!-- ATD-FINANCE-READINESS-ROSTER-NAMING-20260927-END -->
<!-- ATD-URGENT-RELEASE-ROADMAP-20261004-BEGIN -->
## Urgent release and roadmap status - 4 October 2026

### Release validated locally
- Finance Workspace prototype, Notification Centre reference fallback, Assets naming and ticket-close wording are committed locally in `86c8b876b5313f3748378db87b3b25cc77b21871`.
- The commit contains exactly 14 approved paths and tree `4e4948d001b840f4742d08d68210773621e22e86`.
- Backend syntax, staged whitespace validation and isolated frontend production build passed.
- The release is not yet pushed or deployed.

### Remaining delivery blockers
- Push the exact commit through the verified `gitlab` tracking remote and verify the remote tree.
- Confirm the authorised production target, database backup, Finance migration state and rollback point.
- Keep the Finance migration unapplied until the production gate is approved.
- Run controlled post-deployment verification before changing any item from implemented to deployed.

### Remaining priority roadmap
1. Finance Accounts Payable and commercial-intelligence expansion, including governed office queues, approvals, product reporting, Boardroom packs and clean Excel exports.
2. Responsive Employee, Agent and Operations dashboards plus pinned and overlay panel behaviour.
3. Universal header order: Refresh, New Request, Ticket Monitor and far-right Profile Avatar without overlap.
4. Compact Ticket Detail actions, closed-ticket restrictions, governed reopening and repeat-issue reporting.
5. Assignment support-group defaults, configurable multi-group alerts and governed escalation.
6. Broader milestone testing, deployment verification and consolidated README update at the next milestone boundary.
<!-- ATD-URGENT-RELEASE-ROADMAP-20261004-END -->
