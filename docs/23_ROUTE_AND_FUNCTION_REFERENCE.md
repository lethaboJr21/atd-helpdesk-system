# ATD Helpdesk Route and Function Reference

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-6-SCRIPT-591`


## 1. Purpose

This document defines how the detailed route and function catalogue should be maintained. Exact paths, methods, middleware, permissions, and exports remain authoritative in current source.

## 2. Frontend route catalogue

For each frontend route, record:

- Route path and portal base path.
- Page or component entry point.
- Authentication requirement.
- Role, permission, ownership, department, or support-group scope.
- Main user actions.
- API dependencies.
- Deep-link and refresh behaviour.
- Current implementation status.

Primary functional route groups include authentication, employee landing, operations dashboard, ticket monitor, ticket workspace, ticket detail, workspaces, asset or configuration records, ticket archive, Freshservice import, administration, profile, communications, notifications, knowledge, catalogue, onboarding, and access requests.

## 3. Backend API catalogue

For each endpoint, record:

- HTTP method and path.
- Route module.
- Authentication middleware.
- Required permission and scope.
- Request parameters and payload.
- Response and notable status codes.
- Service and database dependencies.
- Side effects, notifications, activity, and audit.
- Idempotency and retry behaviour.

## 4. Service-function catalogue

For each service function, record:

- Module and exported function.
- Functional purpose.
- Inputs and outputs.
- Transaction boundary.
- External side effects.
- Error behaviour.
- Callers.
- Testing and recovery requirements.

## 5. Background functions

Catalogue reminder schedules, inbound email polling, Company Communications scheduling and delivery, directory synchronisation, production-data synchronisation, and other recurring jobs. Record startup behaviour, lock or claim strategy, retry, recovery, and monitoring.

## 6. Notification functions

Notification creation and consumption require special mapping for:

- Notification type.
- Entity type and identifier.
- Ticket identifier and ticket reference.
- Navigation target.
- Governed action type.
- Pending-action state.
- Compatibility version or legacy shape.

Navigation to a ticket must not require a pending governed action object. Assignment acceptance or rejection must remain a separate backend-revalidated action.

## 7. Documentation method

The complete route-and-function inventory should be generated from current source after the urgent notification repair and reconciled against runtime route registration. Generated lists must be reviewed for aliases, disabled modules, legacy endpoints, and environment-specific registration.

## 8. Current limitations

This foundational reference does not claim that every historic route or backup copy is active. Current source and runtime registration take precedence. Production availability requires deployment verification.

## 9. Validation checklist

1. Enumerate active frontend routes.
2. Enumerate registered backend route modules.
3. Map each endpoint to middleware and service functions.
4. Map permissions and scope.
5. Identify external side effects.
6. Identify background entry points.
7. Identify legacy aliases.
8. Verify deep links and API paths.
9. Verify notification target and action mapping.
10. Reconcile the catalogue after deployment.
