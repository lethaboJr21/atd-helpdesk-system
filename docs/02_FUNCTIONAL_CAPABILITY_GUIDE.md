# ATD Helpdesk Functional Capability Guide

## Document control

- **Evidence boundary:** Repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-1-SCRIPT-586`

## 1. Reading this guide

This guide describes functional areas confirmed by current repository evidence. It intentionally avoids treating every source file as a deployed feature. Detailed validation and deployment status will be reconciled in later documentation groups and the capability register.

## 2. Authentication and profile

### Available foundations

- User sign-in and account lifecycle handling.
- Registration and approval foundations.
- Terms or policy acceptance.
- First-login onboarding.
- Current-user profile retrieval and update.
- Secure profile media and avatar handling.
- Role and permission-aware navigation and access.

### Governance expectations

- The backend remains authoritative for access.
- Avatar changes must refresh consistently and provide a fallback.
- Existing accounts with no directory changes must not be written unnecessarily.

## 3. Ticket lifecycle

### Core functions

- Create and view tickets.
- Track requestor, department, priority, type, support group, assignee, status, dates, and SLA information.
- Assign and accept assignments.
- Add requester-visible replies and internal notes.
- Record ticket activity and participant timestamps.
- Resolve and close tickets.
- Reopen resolved tickets when an issue reappears.
- Attach and preview supported files.
- Perform governed bulk operations.
- Archive, restore, and permanently delete through controlled lifecycle rules.

### Required reporting behaviour

Reopened incidents must be separately counted and must support repeat-issue indicators in management reporting.

## 4. Ticket workspaces and queues

The source includes ticket list and detail experiences, filtering, dashboard queues, priority views, archive views, and assignment panels. Broad filtering is expected by department, requestor, priority, incident type, and service-request type. Bulk actions must also operate in the Dashboard Ticket Priority queue.

List/Kanban workspace, adaptive insight panels, saved views, and live refresh must be classified against actual implementation evidence before being presented as complete.

## 5. SLA capability

SLA information is associated with ticket priority and operational handling. Syspro/ERP initial-response targets are:

- Critical: 30 minutes
- High: 3 hours
- Medium: 24 hours
- Low: 48 hours

These are response targets, not resolution guarantees. Infrastructure retains its separate SLA matrix.

## 6. Notifications and activity

### Confirmed foundations

- Persistent notification records.
- Read and unread management.
- Action-required notifications.
- Ticket activity and assignment actions.
- Access-request actions.
- Filtering and clear-completed safeguards.

### Product requirement

Marking a notification as read must not remove or disable a pending governed action. Compact floating change notifications with an Undo option are a priority interaction pattern. Expanded notification history and a dedicated Activity view may be delivered separately.

## 7. Company Communications

### Functional scope

- Campaign authoring and editing.
- Audience selection and exclusions.
- Whole-company, department, management-level, combined position-level, and external-recipient targeting.
- Approval, scheduling, sending, archive, and history foundations.
- Attachments.
- Employee and agent landing-page announcements.
- Announcement conversations and moderation foundations.
- SMTP and Microsoft Graph delivery integration.
- Test and live email-governance modes.

### Current work in progress

The delivery-reliability batch covers duplicate-send protection, browser-timeout resilience, server-tracked asynchronous delivery, strict separation of test and live recipients, and expanded history. This batch must remain marked **in progress** until validated.

### Styling boundary

Email templates use Outlook-compatible ATD branding. Portal Glassmorphism styling must not be applied to email.

## 8. Access management

### Functional scope

- Access requests.
- Role and permission management.
- Temporary or governed entitlements.
- Granted-access display.
- Support groups.
- Administrative review and audit evidence.

Functions already available to a requester should be greyed out. Granted access should be shown separately with its source, such as default, permission, or role. Governed revocation must remain available.

## 9. Dashboards and customisation

The application contains employee and operational dashboards, templates, widgets, priority queues, announcements, and configurable appearance foundations.

Planned appearance capabilities include:

- Light and Dark modes.
- Glassmorphism as an optional portal styling theme.
- Named custom layout templates.
- Responsive layouts and accessible contrast.
- Reduced-transparency or no-blur fallback.

## 10. Knowledge, catalogue, assets, and workspaces

The source contains foundations for knowledge content, request catalogue, guided routing, asset/configuration records, and department or operational workspaces. The final documentation will map each user-facing route and management workflow in later groups.

## 11. Reporting and audit

The system contains audit, activity, health, SLA, statistics, and reporting foundations. Weekly operational reporting is expected to cover assignment volumes, response and resolution durations, SLA performance, request patterns, portal usage, recurring terms, and agent/manager access.

## 12. Integrations

- Microsoft Graph for email and Microsoft-related functions.
- SMTP delivery.
- Microsoft directory synchronisation.
- Inbound email-to-ticket.
- Freshservice historical archive/import functions.
- Production reporting and synchronisation services.

## 13. Capability verification checklist

Before a capability is marked deployed:

1. Confirm active source and migration state.
2. Confirm frontend build and backend checks.
3. Validate role and permission behaviour.
4. Validate negative and unauthorised paths.
5. Validate audit and notification evidence.
6. Confirm deployment commit and production state.
7. Update the capability register and development tracker.
