# ATD Helpdesk External System Integrations

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-4-SCRIPT-589`

## 1. Purpose

This document records the main external-system boundaries identified in the repository. An integration foundation does not prove that the integration is enabled or production validated.

## 2. Integration principles

- Define an authoritative source for each field.
- Use least-privilege credentials.
- Do not expose secrets in logs or reports.
- Make retry idempotent.
- Preserve correlation identifiers and timestamps.
- Record partial failure.
- Avoid silent destructive synchronisation.
- Provide health evidence without sensitive content.

## 3. Freshservice historical integration

Freshservice archive, import, and merge functions support historical records and transition work. Freshservice history is separate from the current ATD Helpdesk ticket lifecycle.

Import or merge processing should preserve source identifiers, avoid duplicates, retain timestamps, and report conflicts. Current-ticket archive, restore, and deletion must not imply changes to Freshservice history unless explicitly implemented.

## 4. Microsoft SQL Server production data

A Microsoft SQL Server connection layer supports production-related data or reporting. PostgreSQL remains the primary ATD Helpdesk application store unless a documented contract states otherwise.

Queries should be parameterised, scoped, observable, and protected from unintended write access. Production-data synchronisation requires a defined owner, schedule, mapping, and recovery process.

## 5. Microsoft Graph and directory

Microsoft Graph and directory processing are documented separately in `15_MICROSOFT_DIRECTORY_AND_GRAPH.md`.

## 6. SMTP

SMTP provides an outbound email path governed by Disabled, Testing, and Live controls. Provider failure and redirection evidence should be durable.

## 7. Email-to-Ticket

Inbound mailbox processing is documented separately in `14_EMAIL_TO_TICKET_AND_EMAIL_GOVERNANCE.md`.

## 8. Microsoft Teams roadmap

The roadmap includes assignment-related prompts and ticket-chat synchronisation. Teams synchronisation should preserve ticket reference, participants, message timestamps, direction, and conversation evidence while respecting internal-note and requester-visibility boundaries.

Teams capability must not be marked deployed without verified source, permissions, validation, and production evidence.

## 9. Asset and configuration records

Existing CMDB functionality and data must be preserved while the portal is rebranded using an approved replacement name. Integration references, routes where appropriate, permissions, reports, notifications, and documentation must be updated without deleting capability.

## 10. Health and monitoring

Each enabled integration should provide last success, last failure, backlog or pending count, retry state, connector identity without secrets, and actionable failure detail.

## 11. Change management

Integration changes require source backup, configuration review, dependency analysis, safe test mode, validation of negative paths, rollback planning, and tracker/documentation updates.

## 12. Validation checklist

1. Identify each enabled integration and owner.
2. Verify credentials are least privilege and not exposed.
3. Verify source-to-target field mapping.
4. Verify duplicate and retry controls.
5. Verify partial failure handling.
6. Verify timestamps and correlation evidence.
7. Verify read/write boundaries.
8. Verify health and alerting.
9. Verify rollback and recovery.
10. Verify production enablement separately from source presence.
