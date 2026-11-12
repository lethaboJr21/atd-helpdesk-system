# ATD Helpdesk Archive, Reopen and Retention

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-2-SCRIPT-587`

## 1. Purpose

This document defines the functional boundaries between active tickets, resolved or closed tickets, reopened tickets, archived tickets, pending deletion, permanent deletion, and historical external-system records.

## 2. Current-ticket lifecycle areas

The current-ticket archive experience includes conceptual areas for:

- Active Tickets
- Archived Tickets
- Pending Deletion

Archiving removes a ticket from normal active workspaces without immediately deleting its data. Restoration returns an eligible archived or pending-deletion ticket to an authorised lifecycle state.

## 3. Archive action

An archive action should record:

- Ticket reference
- Requester
- Department
- Previous status
- Archive actor
- Archive timestamp
- Archive reason
- Applicable retention or deletion date

Archive permission and eligibility must be checked by the backend. A ticket with blocking dependencies should not be silently archived.

## 4. Pending deletion

The implemented lifecycle foundation uses a seven-day governance countdown for eligible current tickets. The production configuration and actual timestamp remain authoritative.

During pending deletion:

- The ticket remains recoverable through authorised restoration.
- The deletion date is visible to authorised users.
- Dependencies and current state remain subject to validation.
- Ordinary users cannot permanently delete the record.

## 5. Permanent deletion

Permanent deletion is restricted to the authorised Superadministrator function and requires high-impact safeguards, including:

- Permission and role validation
- Reason capture
- Typed confirmation
- Dependency checks
- Current-state revalidation
- Durable tombstone or deletion evidence
- Actor and timestamp
- Clear success or failure result

Permanent deletion must not be confused with hiding, archiving, or removing a ticket from a personal view.

## 6. Restoration

A restoration action should:

1. Revalidate the current lifecycle state.
2. Confirm that the ticket has not already been deleted.
3. Restore the correct prior or governed active state.
4. Preserve archive and restoration history.
5. Record actor, reason, and timestamp.
6. Notify authorised stakeholders where configured.

## 7. Reopening resolved tickets

Reopening is an operational lifecycle action, not an archive restoration action.

When a resolved issue reappears, an eligible employee should be able to reopen the ticket. The system must preserve the previous resolution and record the reopening event. Reopened incidents must be explicitly represented in statistics and management reporting.

## 8. Repeat-issue indicators

Management reporting should distinguish:

- First occurrence
- Reopened occurrence
- New ticket related to a previous issue
- Recurring category or service pattern

A repeat-issue indicator should be evidence based and should not automatically merge unrelated tickets.

## 9. Freshservice historical archive

Freshservice archive, import, or merge functionality is a historical external-system capability. It is separate from the lifecycle of current ATD Helpdesk tickets.

Documentation and user interfaces must not imply that deleting or restoring a current ticket changes the retained Freshservice historical source unless an explicit governed integration provides that behaviour.

## 10. Attachments and dependent records

Archive and retention must account for:

- Attachments
- Comments and internal notes
- Activity and audit entries
- Participants
- Notifications
- Assignment records
- Approval records
- Survey records
- External references
- Reporting relationships

Dependency checks should prevent incomplete deletion or preserve required tombstone evidence.

## 11. Retention policy

Final retention periods must be approved by organisational governance and recorded in configuration or policy documentation. The application should distinguish operational lifecycle dates from legal, audit, security, or backup retention requirements.

## 12. Reporting

Archive and retention reporting should support:

- Archived ticket count
- Archive actor and reason
- Pending-deletion count
- Upcoming deletion dates
- Restored ticket count
- Permanent deletion evidence
- Reopened count
- Repeat-issue indicators
- Department, requester, priority, type, and support-group filtering

## 13. Validation checklist

1. Archive an eligible ticket.
2. Reject an unauthorised archive.
3. Verify archive fields and activity.
4. Verify the seven-day pending-deletion presentation.
5. Restore from archived and pending-deletion states.
6. Test dependency-blocked deletion.
7. Test reason and typed confirmation.
8. Verify Superadministrator-only permanent deletion.
9. Verify tombstone or deletion evidence.
10. Reopen a resolved ticket and reconcile statistics.
11. Confirm Freshservice history remains separate.
12. Verify attachments and dependent-record handling.
