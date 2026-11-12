# ATD Helpdesk Microsoft Directory and Graph

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-4-SCRIPT-589`

## 1. Purpose

Microsoft integration supports directory synchronisation and Microsoft Graph-based email or related authorised functions. Exact tenant permissions and enabled operations are deployment configuration, not repository assumptions.

## 2. Directory synchronisation

Directory synchronisation may retrieve account and organisational attributes such as display information, email, department, position, manager context, account state, and profile media where authorised.

## 3. No-change write protection

The system must compare current and proposed values before writing. Accounts with no actual changes must not receive update writes. This reduces noise, risk, and false audit events.

## 4. Change evidence

An actual change should record account, changed fields, previous and new values where policy permits, actor or system process, timestamp, result, and failure details.

## 5. Weekly alert process

Actual directory-account changes should be consolidated into Monday 08:00 weekly alerts with actor details and included with the governed ATD Helpdesk Weekly Report process.

## 6. Microsoft Graph email

Graph email delivery should retain the same governance evidence as SMTP: intended recipient, effective recipient, mode, redirect state, provider, attempt time, result, attachments, and failure information.

## 7. Permissions and least privilege

Application permissions and delegated permissions must be limited to approved functions. Secret or certificate material must not appear in reports, source documentation, browser responses, or health output.

## 8. Error handling

Throttling, token failure, permission denial, invalid recipients, directory conflicts, and partial results require clear retry and failure evidence. Retry must avoid duplicate email or directory writes.

## 9. Profile media

Directory-sourced or locally-managed avatars should use a consistent current-profile source, cache refresh, and fallback behaviour. Media access must be authorised.

## 10. Validation checklist

1. Validate read-only directory retrieval.
2. Validate no-change accounts produce no writes.
3. Validate a controlled actual change and audit evidence.
4. Validate manager, department, and position mapping.
5. Validate Graph permission failure handling.
6. Validate throttling and retry behaviour.
7. Validate Graph email testing isolation.
8. Validate attachment delivery evidence.
9. Validate weekly change-alert content and timing.
10. Verify secrets are absent from reports and health output.
