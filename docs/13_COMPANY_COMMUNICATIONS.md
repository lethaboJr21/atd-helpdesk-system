# ATD Helpdesk Company Communications

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Status:** Communications functional and governance reference
- **Generated marker:** `ATD-DOCS-GROUP-4-SCRIPT-589`

## 1. Purpose

Company Communications provides governed authoring, targeting, approval, scheduling, publication, email delivery, dashboard announcements, attachments, conversations, and delivery evidence.

## 2. Campaign lifecycle

The functional lifecycle includes draft, approval, scheduled, sending, sent or published, failed, cancelled, and archived conditions where supported by the active schema. A state transition must record the actor, time, reason or approval evidence, and relevant delivery information.

## 3. Authoring

A communication may contain a name, subject, plain-text body, HTML body, announcement content, schedule, audience definition, and attachments. Authoring should preserve a content snapshot so history remains accurate after delivery.

## 4. Audience definition

Audience controls must support whole-company, department, management-level, combined position-level, exclusions, selected employees where implemented, and manually entered external addresses. Audience resolution should deduplicate recipients and retain the intended audience snapshot.

## 5. Approval and scheduling

Approve and Send and Approve and Schedule are governed actions. The confirmation should show the campaign, audience, schedule, and delivery mode. The backend must revalidate the campaign and actor before changing state.

## 6. Testing and live delivery

Test delivery must be isolated from live audiences. Explicit campaign tests should use only approved test recipients. Environment-level redirection must be surfaced because it can override the intended email-governance mode.

No implementation or documentation validation should contact live recipients without explicit governed approval.

## 7. Delivery reliability status

The repository evidence identified a browser timeout risk while delivery was processed synchronously. The delivery-reliability batch is still in progress and must not be marked complete until validated.

The target design includes:

- Fast server acknowledgement.
- Background delivery independent of the browser connection.
- One authoritative active operation per campaign.
- Recipient-level claiming and durable outcomes.
- Safe retry without resending confirmed deliveries.
- Recovery from interrupted processing.
- Queued, processing, completed, partial, and failed evidence.

## 8. Announcement history

History should show full content, resolved audience, lifecycle timestamps, recipient outcomes, provider, attempt time, failure details, and environment-redirect evidence. History should remain refreshable while processing.

## 9. Dashboard announcements

Published announcements may appear on employee and agent landing pages when the current user belongs to the authorised audience. Read state and optional governed conversations may be supported.

## 10. Attachments

Communication attachments must be stored and downloaded through authorised endpoints. Email delivery through SMTP or Microsoft Graph should retain compatible attachment evidence.

## 11. Conversations and moderation

Announcement conversations, when enabled, require authorised participation, timestamps, moderation controls, and clear separation from ticket conversations.

## 12. Branding boundary

Portal themes may include Glassmorphism. Email templates use Outlook-compatible ATD branding and must not depend on transparency, backdrop blur, or portal layout effects.

## 13. Audit and reporting

Evidence should include creator, approver, scheduler, sender, cancellation actor, audience snapshot, recipient totals, outcomes, timestamps, and failure information.

## 14. Validation checklist

1. Validate each audience type and exclusion.
2. Validate internal and external deduplication.
3. Validate approval and scheduling permissions.
4. Validate test-recipient isolation.
5. Validate environment-redirect evidence.
6. Validate browser-disconnect and retry behaviour.
7. Validate recipient-level idempotency.
8. Validate attachments through SMTP and Microsoft Graph.
9. Validate dashboard audience restrictions.
10. Validate complete history and audit evidence.
