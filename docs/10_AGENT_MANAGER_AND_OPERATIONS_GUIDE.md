# ATD Helpdesk Agent, Manager and Operations Guide

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-3-SCRIPT-588`

## 1. Purpose

This guide describes operational use by agents and managers. Exact capabilities depend on role, permission, department, support group, assignment, and management scope.

## 2. Operational landing experience

Authorised operational users may access:

- Ticket workspaces and queues.
- Priority views.
- Assigned and group work.
- Ticket detail and activity.
- Notifications and pending actions.
- Company announcements.
- Dashboard templates and widgets.
- Reporting or statistics appropriate to scope.

The interface should preserve working context during safe refresh, including filters, drafts, selections, and scroll position where supported.

## 3. Queue management

Operational queues should support broad filtering by:

- Department.
- Requestor.
- Priority.
- Incident type.
- Service-request type.
- Support group.
- Assignee.
- Status.
- SLA state.

Bulk ticket operations must also work within the Dashboard Ticket Priority queue and must apply ticket-level permission checks.

## 4. Ticket triage

An agent should validate the request, classification, priority, support group, assignee, service category, and SLA basis. Any change must be recorded with actor and timestamp.

Agents should request missing information through a requester-visible reply and must use internal notes only for authorised operational discussion.

## 5. Assignment and acceptance

Assignment may target an agent or support group. Where acceptance is enabled:

1. The assignment creates an actionable notification.
2. The assigned agent reviews the current ticket.
3. The backend revalidates the assignment before acceptance.
4. Acceptance or rejection is recorded.
5. The ticket displays the effective assignee.

A notification remains actionable after being marked read until the underlying action is completed or no longer valid.

## 6. Working a ticket

During investigation or fulfilment, agents should:

- Record meaningful progress.
- Distinguish requester replies from internal notes.
- Preserve complete timestamps and participants.
- Attach only relevant and authorised files.
- Update priority, status, assignment, and due information through governed controls.
- Avoid exposing restricted operational information to the requester.
- Record a clear solution before resolution.

## 7. Manager oversight

Managers may have authorised visibility into team or department queues, workloads, SLA risk, reassignment, escalations, reopened issues, repeat-issue indicators, and operational reporting.

Management access must remain scoped. A management title alone must not grant unrestricted system administration.

## 8. Agent availability and workload

Agent availability is a compulsory roadmap capability. Until validated, availability must not be presented as a reliable routing control.

Expected operational views may include:

- Available or unavailable agents.
- Assigned workload.
- Unaccepted assignments.
- Priority distribution.
- Approaching SLA breach.
- Reassignment frequency.
- Reopened work.

## 9. SLA and escalation

Agents and managers should understand whether displayed targets are initial-response or resolution targets. Syspro/ERP initial-response targets are:

- Critical: 30 minutes.
- High: 3 hours.
- Medium: 24 hours.
- Low: 48 hours.

Infrastructure retains a separate faster SLA matrix. Escalation decisions and SLA-affecting changes must be recorded.

## 10. Notifications and change confirmation

Operational notifications may cover assignment, approval, requester replies, ticket changes, discussions, relevant catalogue events, and SLA conditions.

Brief floating notifications should describe recorded changes and offer Undo only where reversal is safe. Detailed change confirmations should show what changed and what evidence was recorded.

## 11. Archive and reopen operations

Agents and managers may archive, restore, or reopen tickets only within authorised rules. Permanent deletion remains a restricted Superadministrator action.

Reopened incidents must remain visible in statistics and management reporting. Reopening is distinct from restoring an archived ticket.

## 12. Attachments and previews

Agents may preview and download authorised attachments. Full-screen viewing should preserve access checks. Unsupported content should be offered through a safe download path rather than unsafe inline rendering.

## 13. Communications and announcements

Authorised operational users may see targeted announcements. Company Communications administration is separate from ordinary agent work unless permission is explicitly granted.

Live company email must not be tested casually. Testing mode and explicit test recipients must remain isolated from live audiences.

## 14. Reporting expectations

Operational reporting should support:

- Ticket volumes.
- Assignment and acceptance counts.
- First-response and resolution durations.
- SLA compliance and breaches.
- Reopened tickets.
- Repeat issues.
- Request patterns.
- Agent and support-group workload.
- Department, requestor, priority, and type filters.

## 15. Shift and handoff discipline

A handoff should identify:

- High-priority open tickets.
- Unaccepted assignments.
- Pending requester responses.
- Approaching or breached SLA targets.
- Escalations.
- Scheduled or dependent work.
- Relevant outages or system limitations.

The ticket record remains the authoritative operational history.

## 16. Operations validation checklist

1. Validate queue scope for each operational role.
2. Validate filters and bulk actions.
3. Validate triage and routing.
4. Validate assignment acceptance and stale actions.
5. Validate requester replies and internal-note isolation.
6. Validate attachments and previews.
7. Validate status, resolution, reopening, archive, and restore.
8. Validate SLA and escalation evidence.
9. Validate notifications, floating confirmations, and safe Undo.
10. Reconcile dashboards and reports with underlying ticket records.
