# ATD Helpdesk Backend API and Service Architecture

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-5-SCRIPT-590`


## 1. Purpose

The backend provides authentication, authorisation, business rules, persistence, audit evidence, integration orchestration, background processing, and REST APIs for the portal.

## 2. Architecture

The verified backend uses Node.js and Express. Current `backend/src` is the primary source. Route modules expose API operations, middleware establishes identity and policy checks, and services implement reusable business behaviour.

## 3. API boundary

APIs are exposed beneath `/api`. Endpoints should:

1. Authenticate the caller.
2. Validate role, permission, and scope.
3. Validate request input.
4. Revalidate the current entity state.
5. Delegate business logic to an appropriate service.
6. Commit durable state atomically where practical.
7. Create activity or audit evidence.
8. Return a clear status and safe response.

## 4. Authentication and authorisation

Backend checks are authoritative. Protected functions must not rely on hidden buttons or route guards alone. Scope may depend on ownership, department, support group, assignment, management context, role, or direct permission.

## 5. Service layer

Services should contain reusable logic for tickets, communication, email, notifications, attachments, archive, directory, reporting, and other domains. Services should avoid embedding transport-specific response handling when reusable domain results are sufficient.

## 6. Transactions and consistency

Multi-step operations should use database transactions where partial completion would corrupt business state. External side effects such as email cannot always be rolled back, so recipient claims, idempotency, durable outcome records, and recovery states are required.

## 7. Background processing

Schedulers or workers support reminders, inbound email, Company Communications, and synchronisation. Background work requires:

- Durable operation state.
- Idempotency.
- Bounded retry.
- Recovery of interrupted work.
- Correlation and timestamps.
- Failure evidence.
- Safe process restart behaviour.

## 8. Notification actions

Notification records must distinguish navigation targets from governed pending actions. Ticket-opening metadata should be compatible with current and legacy notifications. Governed operations such as assignment acceptance must revalidate backend state.

## 9. Attachments and media

File routes must validate access, normalise paths, prevent traversal, enforce size and type rules, and avoid exposing storage locations. Inline rendering must be limited to safe supported content.

## 10. Audit and observability

Important operations should preserve actor, target, timestamp, result, reason, before/after information where appropriate, and correlation identifiers. Logs and health responses must not expose secrets.

## 11. Error model

Use appropriate HTTP status codes and safe messages. Validation, authorisation, conflict, not-found, accepted-processing, and server failure must be distinguishable. A failure response must not claim that a durable action was completed.

## 12. Backend validation

1. Run syntax or automated checks.
2. Validate migrations against the expected schema.
3. Test authorised, unauthorised, and out-of-scope requests.
4. Test transaction rollback.
5. Test duplicate and retry behaviour.
6. Test background recovery.
7. Test audit and activity evidence.
8. Test file authorisation.
9. Test email and integration modes without live recipients.
10. Test notification navigation and pending actions.
