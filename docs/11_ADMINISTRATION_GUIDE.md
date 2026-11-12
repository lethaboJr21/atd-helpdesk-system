# ATD Helpdesk Administration Guide

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-3-SCRIPT-588`

## 1. Purpose

This guide describes governed administrative responsibilities. Administrative visibility does not automatically authorise every action. The backend role and permission model remains authoritative.

## 2. Administrative areas

Administrative functions may include:

- User and account administration.
- Roles and permissions.
- Access requests and entitlements.
- Support groups.
- Microsoft Directory integration.
- Company Communications.
- Email governance.
- Request catalogue and knowledge administration.
- Asset or configuration records.
- Archive and retention controls.
- Notification settings.
- Audit and health evidence.
- Dashboard templates, themes, and layout management.

## 3. User administration

Authorised administrators may review account status, department, position, role, permissions, profile state, approval state, and directory evidence.

Administrative changes should:

1. Validate the current administrator.
2. Validate the target account and current state.
3. Show the proposed amendment.
4. Require a reason where appropriate.
5. Avoid writing when no value changes.
6. Record actor and timestamp.
7. Notify affected parties where governed.

## 4. Roles and permissions

Roles group permissions for defined responsibilities. Direct permissions should be used carefully because direct grants can be harder to review than role-based access.

Administrators should:

- Keep role names and purposes clear.
- Apply least privilege.
- Avoid duplicate or conflicting grants.
- Review inherited and direct access.
- Preserve revocation controls.
- Test backend enforcement.
- Record material changes.

## 5. Support groups

Support groups represent operational teams used for routing, assignment, alerts, and reporting. Group administration should preserve membership history, active state, routing purpose, and authorised management scope.

Removing a member must not silently orphan assigned work.

## 6. Microsoft Directory

Directory integration may synchronise account and organisational attributes. The integration must not write when an account has no actual changes.

Actual changes should be included in the Monday 08:00 weekly alert process with actor details and governed weekly-report attachment evidence.

Directory writes, if enabled, require explicit scope, failure handling, audit evidence, and protection against unintended bulk changes.

## 7. Company Communications administration

Authorised communication administrators may create, edit, approve, schedule, send, cancel, archive, and review communications according to governance.

Audience controls should support:

- Whole company.
- Department.
- Management level.
- Combined position level.
- Exclusions.
- Manually entered external recipients.

Testing and live delivery must remain separate. Glassmorphism is not an email-template style.

The asynchronous delivery-reliability batch remains in progress until separately validated.

## 8. Email governance

Email governance should expose the effective delivery mode:

- Disabled.
- Testing.
- Live.

Environment-level recipient redirection must be visible because an environment override may supersede the intended mode. Administrators must not switch live delivery without governed approval and test evidence.

## 9. Catalogue and knowledge administration

Administrative functions may manage service categories, catalogue items, guided request paths, and solution or knowledge content. Changes should preserve stable references where tickets, notifications, or reports depend on them.

## 10. Asset and configuration administration

Existing CMDB functionality and data must be preserved. The capability is to be rebranded throughout the portal after an approved replacement name is supplied. Rebranding may affect labels, navigation, routes where appropriate, permissions wording, dashboards, reports, notifications, and documentation.

Rebranding must not delete the underlying functionality or data.

## 11. Archive and retention administration

Administrators may govern archive rules and restoration according to permission. Permanent deletion is restricted to the authorised Superadministrator function and requires reason, typed confirmation, dependency checks, and durable evidence.

## 12. Notification settings

Notification administration should support detailed event selection, including approvals, ticket updates, assignments, solution articles, service categories, task discussions, and journey events.

Pending actions must remain actionable after read.

## 13. Dashboard, theme, and layout administration

Authorised administrative configuration may include dashboard templates, themes, Light/Dark modes, named custom layout templates, and portal styling options.

Glassmorphism is an optional portal theme/layout style. Administrators must maintain accessible contrast and fallback behaviour.

## 14. Audit and health

Administrators should use authorised audit and health views to investigate configuration, integration, processing, and access issues. Health evidence must avoid exposing secrets.

## 15. High-impact change procedure

Before a high-impact administrative change:

1. Identify the affected scope.
2. Capture the current state.
3. Validate permissions and separation of duties.
4. Preview the proposed result.
5. Create backup or rollback evidence where applicable.
6. Apply the minimum change.
7. Validate the result and negative paths.
8. Record actor, reason, timestamp, and outcome.
9. Notify affected parties where required.
10. Update documentation and trackers.

## 16. Administration validation checklist

1. Validate each administrative role and permission.
2. Validate user changes and no-change protection.
3. Validate support-group membership changes.
4. Validate directory dry-run and actual-change evidence.
5. Validate Company Communications testing isolation.
6. Validate email-governance mode evidence.
7. Validate catalogue and knowledge changes.
8. Validate archive and deletion controls.
9. Validate theme and layout configuration.
10. Validate audit, health, rollback, and notification evidence.
