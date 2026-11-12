# ATD Helpdesk Documentation Index

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-6-SCRIPT-591`


## 1. Purpose

This index organises the ATD Helpdesk documentation library and defines the evidence boundary used to prepare it. The documentation describes verified repository functionality, required governance, known work in progress, and planned capabilities without treating source presence as proof of production deployment.

## 2. System foundations

- `01_SYSTEM_OVERVIEW.md`
- `02_FUNCTIONAL_CAPABILITY_GUIDE.md`
- `03_TECHNICAL_ARCHITECTURE.md`
- `04_ROLES_ACCESS_AND_GOVERNANCE.md`

## 3. Ticketing and operations

- `05_TICKET_LIFECYCLE_AND_WORKFLOWS.md`
- `06_ASSIGNMENT_ROUTING_AND_SLA.md`
- `07_TICKET_ACTIVITY_NOTIFICATIONS_AND_AUDIT.md`
- `08_ARCHIVE_REOPEN_AND_RETENTION.md`

## 4. Employee and administration

- `09_EMPLOYEE_EXPERIENCE.md`
- `10_AGENT_MANAGER_AND_OPERATIONS_GUIDE.md`
- `11_ADMINISTRATION_GUIDE.md`
- `12_ACCESS_REQUESTS_AND_ENTITLEMENTS.md`

## 5. Communications and integrations

- `13_COMPANY_COMMUNICATIONS.md`
- `14_EMAIL_TO_TICKET_AND_EMAIL_GOVERNANCE.md`
- `15_MICROSOFT_DIRECTORY_AND_GRAPH.md`
- `16_EXTERNAL_SYSTEM_INTEGRATIONS.md`

## 6. Technical and operations

- `17_FRONTEND_ARCHITECTURE.md`
- `18_BACKEND_API_AND_SERVICE_ARCHITECTURE.md`
- `19_DATABASE_AND_MIGRATIONS.md`
- `20_CONFIGURATION_REFERENCE.md`
- `21_DEPLOYMENT_AND_OPERATIONS.md`
- `22_TROUBLESHOOTING_AND_FAILURE_MODES.md`

## 7. Final references

- `23_ROUTE_AND_FUNCTION_REFERENCE.md`
- `24_SECURITY_AND_PRIVACY_CONTROLS.md`
- `25_KNOWN_LIMITATIONS_AND_ROADMAP.md`
- `26_DEVELOPER_ONBOARDING_GUIDE.md`

## 8. Capability status language

Use only these classifications:

- Implemented and deployed
- Implemented and validated locally
- Implemented locally, validation pending
- Partially implemented
- Foundation present
- Planned
- Deferred
- Legacy or retained for compatibility
- Unable to verify

## 9. Evidence precedence

1. Current active source under `backend/src` and `frontend/src`.
2. Current database migrations.
3. Current configuration and package metadata.
4. Verified deployment and production evidence.
5. Existing development trackers and capability register.
6. Current documentation and Project README.
7. Release packages.
8. Backups and historical source.

## 10. Immediate post-documentation priority

The next engineering task is the production Notification Centre repair. Assignment alerts display ticket references, but selecting Open reports: `This notification does not contain a valid ticket action.` Source collection must inspect notification creation, serialization, frontend action parsing, ticket-reference mapping, legacy compatibility, and a safe ticket-opening fallback.

## 11. Documentation maintenance

Update the relevant document when a capability crosses a status boundary, a route or permission changes, a migration is applied, an integration is enabled, or a production defect changes expected behaviour. Keep roadmap statements separate from current functionality.
