# ATD Helpdesk Email-to-Ticket and Email Governance

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-4-SCRIPT-589`

## 1. Purpose

This document describes outbound email governance and inbound Email-to-Ticket processing. The two capabilities share email infrastructure but have distinct data and security requirements.

## 2. Email-governance modes

The effective outbound mode should be visible as Disabled, Testing, or Live.

- **Disabled:** Delivery is skipped with durable evidence.
- **Testing:** Delivery is redirected only to approved test recipients.
- **Live:** The authoritative intended recipients are used.

An environment-level `EMAIL_REDIRECT_ALL` value can override the intended mode and must be shown in health and delivery evidence.

## 3. Outbound delivery

Outbound delivery may use SMTP or Microsoft Graph. Evidence should include intended recipient, effective recipient where redirected, provider, attempt time, result, failure, governance mode, and redirect state.

## 4. Safe testing

Testing must not contact live audiences. Test subjects and content may identify the intended recipient, but personal information should be limited. Switching to Live requires governed approval and environment verification.

## 5. Email-to-Ticket intake

Inbound processing should identify new requests and replies to existing tickets. It should preserve sender, recipients, subject, received timestamp, message identifier, conversation reference, and safe body content.

## 6. Ticket-reference matching

A reply should be associated with an existing ticket only when the reference is valid and authorised processing rules are satisfied. Ambiguous references should not update an unrelated ticket.

## 7. Duplicate prevention

Inbound processing must use durable identifiers or equivalent evidence to stop a retried mailbox read from creating duplicate tickets, replies, attachments, activity, or notifications.

## 8. Requester reply versus internal note

Inbound messages from the requester or authorised external participant should default to requester-visible conversation. Internal notes require an explicit trusted internal workflow and must never be inferred only from a subject phrase supplied by an external sender.

## 9. Attachments and content safety

Inbound attachments require size, type, storage, malware-control, and authorisation handling. Remote content and unsafe HTML should not be rendered without sanitisation.

## 10. Failure and retry

Mailbox retrieval, parsing, ticket matching, attachment storage, activity creation, and notification delivery should have separate outcomes. Retry must be idempotent and must preserve failure evidence.

## 11. Operational evidence

Health and reporting should identify last successful poll, mailbox or connector identity without secrets, processed count, duplicate count, failure count, and oldest unresolved failure.

## 12. Validation checklist

1. Create a ticket from a valid inbound message.
2. Match a valid reply to an existing ticket.
3. Reject ambiguous and invalid references safely.
4. Verify duplicate-message protection.
5. Verify requester-visible and internal-note isolation.
6. Verify sender, recipient, and timestamps.
7. Verify attachments and unsafe-content handling.
8. Verify Disabled, Testing, and Live outbound modes.
9. Verify environment redirect evidence.
10. Verify retry, audit, notification, and reporting evidence.
