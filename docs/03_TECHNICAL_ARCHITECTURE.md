# ATD Helpdesk Technical Architecture

## Document control

- **Evidence boundary:** Repository scan generated 17 September 2026
- **Source branch:** `feature/launch-communications-queue-compatibility`
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-1-SCRIPT-586`

## 1. Architecture summary

ATD Helpdesk is a browser-based service-management platform with a React/Vite frontend, Node.js/Express backend, PostgreSQL application database, and selected external integration services.

```text
Browser
  |
  | HTTPS / REST
  v
React + Vite frontend
  |
  | /api
  v
Node.js + Express backend
  |
  +--> PostgreSQL application database
  +--> Microsoft Graph and SMTP email
  +--> Microsoft directory services
  +--> Inbound email processing
  +--> Microsoft SQL Server production-data integration
  +--> Freshservice historical integration
```

## 2. Frontend layer

### Responsibilities

- Route and page composition.
- Role-aware navigation.
- Forms, filters, dialogs, tables, cards, queues, workspaces, and previews.
- User feedback, notifications, and interaction state.
- API consumption through shared service clients.
- Portal appearance and responsive behaviour.

### Architecture rules

- Do not treat hidden frontend controls as authorisation.
- Preserve filters, drafts, selections, and scroll position during live workspace updates where supported.
- Standardise Back to Admin and Back to Dashboard controls.
- Apply Glassmorphism only through portal theme/layout styling.
- Maintain accessible contrast and fallback behaviour.

## 3. Backend layer

### Responsibilities

- Authentication and current-user context.
- Backend authorisation and governed actions.
- Ticket, user, notification, communications, archive, knowledge, catalogue, and administration APIs.
- Validation and business rules.
- Audit creation.
- Email and external integration orchestration.
- Background scheduling and recurring processing.

### API model

The backend exposes REST APIs under `/api`. Route modules should remain thin where possible, delegating business logic to services. High-impact operations require explicit validation, permissions, and audit evidence.

## 4. Data layer

### PostgreSQL

PostgreSQL is the primary application data store. Repository migrations define and evolve the application schema. Documentation of individual tables, keys, indexes, and migration order will be produced in the database documentation group.

### Microsoft SQL Server

A separate Microsoft SQL Server integration layer supports production-related data or reporting. This external store must not be treated as the authoritative application database unless an integration contract explicitly states otherwise.

### Data-management rules

- Migrations must be ordered, reviewable, and reversible where practical.
- Existing data must be preserved during rebranding and capability repair.
- Production schema state must be verified rather than inferred from local migrations.
- High-impact deletion requires dependency checks and durable evidence.

## 5. Background processing

The source contains scheduler or background-processing foundations for reminders, inbound email, Company Communications, and production synchronisation.

Background jobs must provide:

- Idempotent operation.
- Durable states.
- Retry and failure evidence.
- Protection against duplicate delivery.
- Timestamps and actor or system attribution.
- Safe start-up and restart behaviour.

The Company Communications asynchronous delivery conversion remains in progress.

## 6. Email architecture

Email can be delivered through SMTP or Microsoft Graph. Shared email governance controls determine Disabled, Testing, or Live behaviour. Environment-level redirect configuration must be visible in evidence because an environment override can supersede the intended governance mode.

Test delivery and live audience delivery must remain isolated. No documentation or validation step should send live email without explicit governed approval.

## 7. Authentication and authorisation

Authentication establishes the current user. Authorisation combines roles, permissions, defaults, and governed grants. The backend must validate every protected action irrespective of frontend visibility.

Administrative and high-impact functions require stronger controls, including confirmation, reason capture, typed confirmation where appropriate, audit evidence, and restricted roles.

## 8. File and media handling

The system contains profile media, ticket attachments, communication attachments, downloads, and preview foundations. File access must remain authorised, path-safe, and content-type aware. Uploaded operational content is excluded from source-collection reports.

## 9. Observability and audit

Operational evidence includes:

- Application logs.
- Health endpoints or health evidence.
- Audit records.
- Ticket activity.
- Notification records.
- Delivery history.
- Deployment and validation reports.

A successful request is not sufficient evidence for high-impact processing. Durable database state and audit evidence should be used where available.

## 10. Deployment boundary

Deployment is a separate governed process involving validation, curated Git changes, remote backup, migration review, dependency handling, frontend activation, process restart, and production verification.

Documentation generation does not build, deploy, migrate, email, stage, commit, or connect to production.

## 11. Source precedence

When sources conflict, use this order:

1. Current `backend/src` and `frontend/src`.
2. Current database migrations.
3. Current configuration and package metadata.
4. Verified deployment or production evidence.
5. Current trackers and capability register.
6. Current README and documentation.
7. Release packages.
8. Backups and historical source.

## 12. Planned architecture documentation

After deployment, the documentation programme will add:

- Modular architecture reference.
- Architecture Decision Record library.
- Function rationale records.
- Failure-mode register.
- Decision playbooks.
- Complete route and function reference.
