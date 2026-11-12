# ATD Helpdesk Ticket Lifecycle and Workflows

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Status:** Ticketing and operations reference
- **Generated marker:** `ATD-DOCS-GROUP-2-SCRIPT-587`

## 1. Purpose

This document describes the governed lifecycle of a ticket in ATD Helpdesk, from creation to closure, reopening, archive, restoration, and deletion. Exact frontend visibility depends on the current user's role, permission, ownership, department, support group, and assignment scope.

## 2. Ticket categories

ATD Helpdesk supports operational records representing incidents and service requests. A ticket should preserve its type and related service information so that queues, reporting, routing, SLA rules, and management statistics can distinguish the work accurately.

Required filtering dimensions include:

- Department
- Requestor
- Priority
- Incident type
- Service-request type
- Support group
- Assignee
- Status and lifecycle state
- SLA state

## 3. Creation workflow

A ticket creation workflow should capture the minimum information required to understand and route the request:

1. Requestor identity and contact context.
2. Department or organisational context.
3. Ticket type.
4. Subject and description.
5. Priority or impact information.
6. Service category or request type.
7. Attachments where necessary.
8. Optional collaborators or employee CC recipients where enabled.
9. The source of the request, such as portal, email, integration, or authorised administration.

After creation, the system should assign a durable ticket reference, record the creation timestamp, create the opening activity, and notify authorised participants according to configured notification rules.

## 4. Lifecycle states

The exact database values remain authoritative. The functional lifecycle includes these conceptual states:

- **New or Open:** The request exists and awaits triage or work.
- **Assigned:** An agent or support group is responsible for the request.
- **In progress:** Investigation or fulfilment is underway.
- **Pending:** Work is waiting for requester input, approval, dependency, supplier, scheduled activity, or another governed condition.
- **Resolved:** A solution has been supplied and the ticket may still be reopened.
- **Closed:** The operational lifecycle is complete according to closure rules.
- **Reopened:** A previously resolved issue has reappeared or requires further work.
- **Archived:** The ticket is removed from active workspaces but retained.
- **Pending deletion:** The governed retention countdown is active.
- **Permanently deleted:** A restricted deletion action has completed and durable evidence is retained.

A status change must record the actor, previous state, new state, timestamp, and reason where required.

## 5. Triage and classification

Triage establishes the correct priority, type, support group, assignee, service category, and SLA basis. Agents should be able to identify insufficient information and request clarification without losing the original request context.

Triage changes must be reflected in ticket activity and relevant notifications. Changes that affect SLA handling, responsibility, or requester expectations require clear evidence.

## 6. Assignment workflow

Assignment may target an agent, support group, or other authorised operational owner. Where assignment acceptance is enabled, assignment and acceptance are distinct events:

1. An authorised actor assigns the ticket.
2. The selected agent receives an actionable notification.
3. The agent accepts or rejects according to governed rules.
4. The acceptance decision is recorded with actor and timestamp.
5. The ticket header and activity show the effective assignee.

A rejected or expired assignment must not silently leave a ticket without operational ownership.

## 7. Conversation and collaboration

Ticket communication should preserve a complete chronological conversation with timestamps and participants.

### Requester-visible reply

A requester-visible reply is part of the external ticket conversation and may trigger email or portal notification to the requester and authorised participants.

### Internal note

An internal note is restricted to authorised support users. Internal notes must never be exposed to the requester through the portal, outbound email, exports, or unauthorised APIs.

### Participants

The platform roadmap includes optional collaborators, an employee CC picker, optional support-group alerts, assignee email, and Teams ticket-chat synchronisation. These capabilities must be marked according to verified implementation status before being presented as complete.

## 8. Attachments

Attachments should retain:

- Uploader
- Upload timestamp
- Original filename
- Stored reference
- Content type and size
- Ticket relationship
- Authorisation requirements

Supported files may be previewed inline or in a full-screen viewer. Download and preview endpoints must enforce ticket access.

## 9. Resolution and closure

Resolution should record the solution, resolver, resolution timestamp, relevant categorisation, and any requester communication. Closure should follow configured governance and should preserve the complete audit and conversation history.

Resolved and closed surveys are compulsory roadmap capabilities. Documentation must not classify surveys as deployed without source and validation evidence.

## 10. Reopening

Employees must be able to reopen a resolved ticket when the issue reappears, subject to the configured eligibility rules. Reopening must:

- Create a distinct activity entry.
- Identify the actor and timestamp.
- Preserve the previous resolution.
- Return the ticket to an actionable state.
- Notify the appropriate operational owner.
- Increment reopened-ticket statistics.
- Support repeat-issue indicators in management reporting.

## 11. Bulk operations

Governed bulk operations include selection and authorised changes such as edit, assignment, archive, and deletion. Bulk actions must:

- Work in the ticket workspace and Dashboard Ticket Priority queue where supported.
- Show the selected ticket count.
- Preview the intended action.
- Require confirmation for high-impact changes.
- Apply permission and scope checks to every ticket.
- Record per-ticket success and failure.
- Preserve rollback or recovery evidence where practical.
- Offer the required Microsoft Teams prompt where configured.

## 12. Failure and recovery principles

- A failed action must not report success.
- Repeated requests must not create duplicate activity or communication.
- Partial bulk operations must report each outcome.
- Ticket drafts, filters, selection, and scroll position should be preserved during safe refresh where supported.
- Repairs must preserve existing ticket data and working functionality.

## 13. Validation checklist

1. Create each supported ticket type.
2. Validate required fields and unauthorised paths.
3. Validate classification, assignment, acceptance, and reassignment.
4. Validate requester replies and internal-note isolation.
5. Validate attachments and access restrictions.
6. Validate all lifecycle transitions.
7. Validate resolution, closure, and reopening.
8. Validate activity, notifications, timestamps, and actor evidence.
9. Validate bulk operations and partial failure reporting.
10. Validate reporting counts for reopened and repeat issues.
