# ATD Helpdesk Assignment, Routing and SLA

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-2-SCRIPT-587`

## 1. Purpose

This document defines the functional expectations for ticket routing, assignment, agent availability, escalation, and service-level tracking.

## 2. Routing inputs

Routing decisions may use:

- Ticket type
- Service category
- Department
- Requestor context
- Priority and impact
- Support group
- Agent skills or permissions
- Agent availability
- Existing workload
- Catalogue or guided-request rules
- Email-to-ticket attributes
- Manual governed assignment

The backend remains authoritative for the resolved support group and assignee.

## 3. Support-group routing

A support group represents an authorised operational team. Routing should:

1. Resolve the correct group from explicit selection or configured rules.
2. Verify that the group is active and authorised for the function.
3. Notify the appropriate group or member according to configuration.
4. Record routing evidence in ticket activity.
5. Preserve the previous owner when a change occurs.
6. Avoid silently routing to an unavailable or invalid destination.

Optional support-group alerts remain subject to implementation verification.

## 4. Agent assignment

An assignment should identify:

- Assigning actor
- Assigned agent
- Support group
- Assignment timestamp
- Acceptance status where enabled
- Acceptance or rejection timestamp
- Reason for governed reassignment where required

The ticket header should expose the effective assignee, creation date, and deadline or SLA date to authorised users.

## 5. Assignment acceptance

An actionable assignment notification should remain actionable even when marked read. The acceptance workflow must revalidate the current ticket and user state before applying the action.

A stale acceptance attempt should return a clear result rather than overwrite a later assignment.

## 6. Agent availability

Agent availability is a compulsory roadmap capability. Expected states may include available, busy, unavailable, off duty, or another approved operational vocabulary. Routing must not rely on an availability value until the capability is fully implemented and governed.

Availability changes should record actor, effective time, and optional expiry. Managers should have authorised visibility into team availability.

## 7. Priority

Priority determines urgency and may influence response targets, queue order, notification, and escalation. Priority changes require appropriate authorisation and activity evidence.

Dashboard priority queues must support broad filtering and governed bulk operations without bypassing ticket-level permissions.

## 8. SLA definitions

An SLA can include initial-response, update, resolution, or other service targets. The applicable SLA must be selected from the ticket's operational context and retained for reporting.

### Syspro/ERP initial-response targets

- **Critical:** 30 minutes
- **High:** 3 hours
- **Medium:** 24 hours
- **Low:** 48 hours

These values are initial-response targets, not resolution guarantees.

### Infrastructure SLA

Infrastructure retains a separate, faster SLA matrix. Infrastructure targets must not be replaced by the Syspro/ERP values.

## 9. SLA clock behaviour

The exact implementation and business calendar are authoritative. SLA documentation must identify:

- Start event
- Target timestamp
- Time zone
- Business hours or calendar basis
- Pause conditions
- Resume conditions
- First-response evidence
- Breach state
- Resolution evidence
- Reopen behaviour

A ticket reopened after resolution must not erase the original SLA evidence. Reporting should distinguish the initial lifecycle from reopened work.

## 10. Escalation

Escalation may be triggered by urgency, approaching breach, breach, reassignment failure, prolonged pending state, or a manager decision. Escalation should produce a durable activity record and appropriate notification.

An escalation must not silently change ownership or priority without recording the change.

## 11. Notifications

Routing and SLA notification settings must accommodate assignment, acceptance, approaching breach, breach, status change, requester reply, approval, and other configured events.

Pending actions must remain available after a notification is marked read.

## 12. Reporting

Operational reporting should support:

- Assignment volume
- Unassigned tickets
- Acceptance duration
- Agent and support-group workload
- Initial-response duration
- Resolution duration
- SLA compliance
- Breach reasons
- Reassignment frequency
- Reopened incidents
- Repeat-issue indicators

## 13. Validation checklist

1. Validate automatic and manual support-group routing.
2. Validate assignment, acceptance, rejection, and reassignment.
3. Validate stale or conflicting actions.
4. Validate agent availability when implemented.
5. Validate each priority and SLA matrix.
6. Validate SLA start, pause, resume, response, breach, and resolution evidence.
7. Validate dashboards, filters, queues, and bulk operations.
8. Validate notifications and escalation.
9. Validate unauthorised and out-of-scope users.
10. Reconcile reporting totals with ticket history.
