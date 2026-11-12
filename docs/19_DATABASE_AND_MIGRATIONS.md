# ATD Helpdesk Database and Migrations

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-5-SCRIPT-590`


## 1. Purpose

PostgreSQL is the primary ATD Helpdesk application database. Repository migrations define schema evolution. A separate Microsoft SQL Server integration supports production-related data or reporting and is not assumed to be the primary application store.

## 2. Source of truth

The production schema must be verified from the production database and migration evidence. A migration file in the repository does not prove that the migration was applied.

## 3. Core data domains

The database contains or supports domains for users, roles, permissions, access requests, tickets, assignments, comments, activity, notifications, attachments, communications, deliveries, announcements, audit, archive lifecycle, preferences, catalogue, knowledge, support groups, and integration state.

Exact table and column definitions remain authoritative in the active migration and source files.

## 4. Migration rules

- Use sequential, reviewable migration files.
- Avoid destructive changes without backup and approved recovery.
- Preserve existing data during rebranding or refactoring.
- Make repeat execution safe where practical.
- Record applied migration evidence.
- Separate schema change from live data repair when appropriate.
- Validate indexes, constraints, defaults, and foreign keys.

## 5. Transactions

Schema and data changes should use transactions where supported. Large or locking operations require a deployment plan, expected duration, and rollback route.

## 6. Constraints and indexes

Constraints should enforce valid relationships and uniqueness where business rules require it. Indexes should support ticket queues, reference lookup, notification retrieval, activity ordering, recipient delivery state, audit queries, and reporting without unnecessary write overhead.

## 7. Idempotency

Durable identifiers should protect against duplicate inbound messages, duplicate communication recipients, repeated assignment actions, and repeated migrations. `ON CONFLICT` handling must match the intended business key and must not silently hide incorrect data.

## 8. Archive and deletion

Archive is not deletion. Pending deletion, restoration, permanent deletion, dependent records, and tombstone evidence require explicit schema and service support. Permanent deletion must retain the evidence required by policy.

## 9. Communication delivery state

Communication processing requires durable campaign and recipient states. The in-progress delivery-reliability design must be validated before it is documented as complete.

## 10. Backup and recovery

Before deployment migrations:

1. Verify the target environment and database.
2. Capture a usable backup.
3. Record backup location and integrity evidence.
4. Apply migrations in order.
5. Validate schema and critical queries.
6. Retain rollback or recovery instructions.

## 11. Sensitive data

Database credentials, tokens, secrets, and private keys must not be committed or included in reports. Personal information must be accessed and retained only for authorised purposes.

## 12. Migration validation

- Confirm pending and applied migration lists.
- Confirm schema objects and constraints.
- Test application startup and critical routes.
- Test legacy data compatibility.
- Verify no unintended row changes.
- Verify indexes and query behaviour.
- Verify backup and restore procedures.
- Record the final migration state in deployment evidence.
