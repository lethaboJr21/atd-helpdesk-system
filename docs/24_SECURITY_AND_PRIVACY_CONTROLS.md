# ATD Helpdesk Security and Privacy Controls

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-6-SCRIPT-591`


## 1. Purpose

This document records the security and privacy controls expected across ATD Helpdesk. It is not a substitute for an approved organisational security policy or formal security assessment.

## 2. Identity and authentication

- Require authenticated access to protected functions.
- Use approved session or token controls.
- Protect credentials and secrets.
- Enforce secure cookie and transport settings where applicable.
- Record account approval, onboarding, and acceptance state.
- Terminate or restrict invalid and inactive accounts.

## 3. Authorisation

The backend must enforce roles, permissions, ownership, department, support-group, management, and other applicable scope. Hidden frontend controls are not sufficient.

High-impact actions require stronger controls, including restricted roles, explicit confirmation, reason capture, current-state validation, and durable audit evidence.

## 4. Least privilege and access governance

Access should be granted through maintainable roles where appropriate. Direct and temporary grants require justification, visibility, expiry or revocation, and audit evidence. Effective access must show the grant source.

## 5. Data protection

- Collect only information required for support and operations.
- Restrict personal information to authorised users.
- Keep internal notes separate from requester-visible content.
- Avoid placing passwords or secrets in tickets.
- Redact secrets from logs, health output, reports, and documentation.
- Preserve required retention and deletion evidence.

## 6. Application security

- Validate input at the backend.
- Use parameterised database queries.
- Encode or sanitise untrusted output.
- Protect against path traversal and unsafe file rendering.
- Apply content and size controls to uploads.
- Use safe error messages.
- Maintain dependency and build review.

## 7. Email and communications safety

Testing and live recipients must remain isolated. Effective email governance and environment redirection must be visible. Duplicate processing must not resend confirmed communications. Whole-company communication is a high-impact action.

## 8. Integration security

Microsoft Graph, directory, SMTP, SQL Server, Freshservice, Teams, and other integrations require approved identities and least-privilege permissions. Connector secrets must not be committed or included in shareable reports.

## 9. Audit and monitoring

Record significant authentication, access, ticket, communication, directory, archive, and administrative events. Audit access must itself be restricted and reviewable.

Operational monitoring should detect repeated failures, duplicate processing, unauthorised attempts, backlog, integration failure, and health degradation without exposing sensitive data.

## 10. File and media controls

Authorise every download and preview against the current user. Store files outside publicly executable locations where practical. Use safe filenames, content types, size limits, and malware controls approved by the organisation.

## 11. Privacy in notifications

Notification previews should expose only information required for the authorised user. Shared displays must not reveal restricted ticket content. Marking a notification read must not execute or cancel a pending action.

## 12. Backup and recovery

Backups must be protected, access-controlled, tested, and retained according to policy. A backup that cannot be restored is not adequate recovery evidence.

## 13. Security validation

1. Test authorised and unauthorised users.
2. Test ownership and organisational scopes.
3. Test direct API access without frontend controls.
4. Test file access and unsafe content.
5. Test secrets and error redaction.
6. Test email-mode isolation.
7. Test duplicate and retry protection.
8. Test high-impact confirmations.
9. Review dependencies and deployment configuration.
10. Record and remediate findings before production release.
