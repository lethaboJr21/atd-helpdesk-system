# ATD Helpdesk Troubleshooting and Failure Modes

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-5-SCRIPT-590`


## 1. Purpose

This guide provides a structured way to investigate failures without repeatedly applying speculative repairs.

## 2. Troubleshooting method

1. Record the exact symptom, time, user scope, and environment.
2. Reproduce safely.
3. Collect complete current source and dependencies.
4. Identify the responsible layer.
5. Capture logs and durable state.
6. Form a testable cause.
7. Apply the smallest guarded repair.
8. Validate positive, negative, and regression paths.
9. Preserve backup and rollback.
10. Update reports, trackers, and documentation.

If repeated script repairs fail, use an alternate guarded implementation route and then resume sequential scripting.

## 3. Authentication and routing failures

Check portal base path, API availability, current-user request, cookies or tokens, reverse-proxy rules, deep-link fallback, and post-login return paths.

## 4. Frontend build failures

Capture the first substantive error, file, line, and import. Avoid treating all later cascade errors as separate causes. Verify source drift before automated patching.

## 5. API failures

Check request payload, authentication, permissions, scope, route logs, database error, transaction outcome, and response status. Confirm that the browser error matches the durable server state.

## 6. Database and migration failures

Verify the target database, applied migrations, locks, permissions, syntax, constraints, and backup state. Do not repeatedly apply a partially completed migration without reconciliation.

## 7. Email failures

Check effective governance mode, `EMAIL_REDIRECT_ALL`, sender identity, provider configuration, recipient resolution, delivery record, provider response, and retry state. Do not test with live recipients during repair.

## 8. Browser timeout with completed server work

A browser timeout does not prove failure. Inspect campaign or ticket state, delivery rows, audit evidence, and logs before retrying. Retrying without idempotency can duplicate external side effects.

## 9. Notification Centre invalid ticket action

### Symptom

Assignment alerts display ticket references and an Open button, but selecting Open produces `Action not completed: This notification does not contain a valid ticket action.` Multiple error toasts and a dashboard warning may appear.

### Priority

Repair immediately after documentation.

### Investigation checklist

- Compare current and legacy notification payloads.
- Inspect action type, entity type, entity ID, ticket ID, and ticket reference.
- Inspect frontend action parsing and Open-button dispatch.
- Inspect backend notification serialization.
- Separate navigation from governed assignment actions.
- Add a safe ticket-opening fallback when a valid ticket reference or ID exists.
- Revalidate acceptance or rejection actions on the backend.
- Prevent duplicate error toasts from one click.
- Test assignment, approval, discussion, access-request, and informational notifications.

## 10. Attachment failures

Check authorisation, ticket relationship, stored path, file existence, content type, size, preview support, and proxy or static-delivery rules.

## 11. Avatar failures

Check current profile media reference, authorisation, cache-busting value, stale browser cache, fallback rendering, and consistency across portal surfaces.

## 12. Deployment failures

Identify the exact stage: push, remote fetch, backup, migration, dependency installation, build, asset activation, process restart, health, or verification. Resume only from a reconciled safe checkpoint.

## 13. Failure evidence template

Record:

- Date and time.
- Environment.
- User or role scope.
- Exact action.
- Expected and actual result.
- Screenshot or console evidence.
- Relevant request or correlation ID.
- Logs and database state.
- Suspected layer.
- Backup and rollback state.
- Repair script and validation result.

## 14. Escalation criteria

Escalate when there is data loss risk, unauthorised access, live-email risk, repeated external side effects, failed backup, unknown production state, migration inconsistency, or inability to restore service safely.
