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
