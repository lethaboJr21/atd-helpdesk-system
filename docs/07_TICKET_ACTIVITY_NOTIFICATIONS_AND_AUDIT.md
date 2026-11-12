# ATD Helpdesk Ticket Activity, Notifications and Audit

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-2-SCRIPT-587`

## 1. Purpose

Ticket activity, notifications, and audit evidence provide related but distinct records of system use.

- **Ticket activity** explains what happened on a ticket.
- **Notifications** tell a user that something requires attention or has changed.
- **Audit evidence** provides durable governance and investigation records.

## 2. Ticket activity requirements

Each significant ticket event should identify:

- Participant or system actor
- Activity type
- Human-readable summary
- Ticket reference
- Timestamp
- Previous and new values where appropriate
- Related comment, attachment, assignment, approval, or lifecycle event
- Visibility classification where appropriate

Examples include creation, classification, priority change, assignment, acceptance, reply, internal note, attachment, status change, resolution, closure, reopening, archive, restore, and deletion action.

## 3. Compact activity display

The ticket detail interface may show a compact latest-activity view with a small number of recent entries and a View more or View less control. Compact presentation must not delete or conceal the durable history from authorised users.

## 4. Notification Centre

The Notification Centre supports persistent records and user-facing organisation. Confirmed foundations include:

- All, Approvals, and Discussions filtering
- Read and unread state
- Mark all as read
- Action-required notifications
- Actor avatar or initials
- Type, reference, summary, and timestamp
- Protection of pending actions from Clear completed

## 5. Actionable notifications

Marking a notification as read acknowledges visibility only. It must not complete, reject, remove, or disable a pending action.

Before applying an action from a notification, the backend must revalidate:

1. Current user authorisation.
2. Current entity state.
3. Current ownership or scope.
4. Whether the action is still pending.
5. Whether a newer action superseded the notification.

## 6. Required notification events

Notification settings are expected to cover detailed events including:

- Approvals
- Ticket updates
- Assignment and acceptance
- Solution articles
- Service categories
- Task discussions
- Journey request and task events
- Requester replies
- Internal operational events where authorised
- SLA and escalation events
- Archive, restore, and governed deletion events

Each event must be classified against current implementation evidence before publication as complete.

## 7. Floating change notifications

A compact centred floating notification should describe a completed amendment and provide an Undo option where safe and supported.

Undo must:

- Be time-bound where appropriate.
- Revalidate the current state.
- Refuse unsafe reversal.
- Create its own activity and audit evidence.
- Avoid reversing irreversible external side effects such as a delivered email.

Expanded notification history and a separate detailed Activity view may be implemented later.

## 8. Audit evidence

Audit entries for governed actions should include:

- Actor or system identity
- Action name
- Target entity and identifier
- Timestamp
- Request or correlation identifier where available
- Before and after state where appropriate
- Reason, approval, or confirmation evidence
- Result and failure information
- Source channel

Audit evidence should be immutable to ordinary users and accessible only within authorised scope.

## 9. Privacy and visibility

- Internal notes must not appear in requester notifications.
- Personal information must be limited to authorised operational need.
- Notification text should avoid exposing restricted ticket content on shared displays.
- Audit access must be permission controlled.
- Attachment links must enforce current authorisation when opened.

## 10. Delivery and retry

Notification creation and external message delivery are separate outcomes. A notification may exist even when an email is skipped or fails. The system should preserve provider, attempt time, failure, intended recipient, and governance evidence where applicable.

Duplicate processing must not create duplicate durable notifications or repeat an irreversible external action.

## 11. Retention and clearing

User-facing Clear completed behaviour should remove or hide only eligible completed notifications. It must not remove unresolved approvals, assignments, access requests, or other pending actions.

Audit and ticket activity retention is governed separately from personal notification presentation.

## 12. Validation checklist

1. Generate every supported ticket activity type.
2. Verify actor, activity, and timestamp.
3. Verify requester and internal visibility boundaries.
4. Verify read and unread controls.
5. Verify pending actions remain actionable after read.
6. Verify stale actions fail safely.
7. Verify Clear completed protection.
8. Verify floating notifications and safe Undo where implemented.
9. Verify duplicate-processing safeguards.
10. Verify audit access, retention, and export boundaries.
