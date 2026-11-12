# ATD Helpdesk Roles, Access and Governance

## Document control

- **Evidence boundary:** Repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-1-SCRIPT-586`

## 1. Governance purpose

Access governance ensures that users receive only the functions required for authorised work, while preserving traceability, revocation, separation of duties, and protection of high-impact actions.

## 2. User audiences

### Employee

Typical scope includes personal requests, permitted catalogue and knowledge functions, personal notifications, announcements, profile settings, and authorised employee dashboards.

### Agent

Typical scope includes support queues, assigned work, ticket investigation, communication, internal notes, status updates, attachments, activity, and operational notifications.

### Manager

Typical scope includes team or department visibility, queue oversight, approvals, performance information, escalations, reporting, and selected governed controls.

### Administrator

Typical scope includes user administration, roles, permissions, support groups, access requests, email governance, communications, configuration, audit, and health evidence.

### Superadministrator

Typical scope includes restricted high-impact actions such as governed permanent deletion and other explicitly protected controls. Superadministrator access must not remove the need for evidence, reason capture, confirmation, and audit.

The exact effective permission set must always be derived from current backend rules, not from these audience summaries.

## 3. Sources of access

Effective access may be provided by:

- Default access.
- Direct permission.
- Role membership.
- Temporary or governed entitlement.
- Support-group or organisational context where explicitly implemented.

The access-request interface must grey out functions already available. Granted access must be displayed separately with its source. All governed grants must remain revocable through authorised controls.

## 4. Enforcement model

### Backend enforcement

Every protected API action must validate the current user, required role or permission, applicable scope, and any additional governance condition.

### Frontend enforcement

The frontend should hide, disable, or explain unavailable actions, but frontend behaviour is not a security boundary.

### Scope enforcement

Access may be limited by requester ownership, assignment, support group, department, management scope, or administrative authority. Exact scope rules will be mapped in later route-level documentation.

## 5. Access-request workflow

A governed access request should record:

1. Requester.
2. Requested function or entitlement.
3. Business reason.
4. Current access and grant source.
5. Approval or rejection actor.
6. Decision timestamp.
7. Effective and expiry dates where applicable.
8. Revocation evidence.
9. Notifications and audit trail.

Pending actions must remain actionable after their notification is marked read.

## 6. High-impact actions

High-impact actions require proportionate safeguards. Examples include:

- Permanent ticket deletion.
- Bulk archive or delete.
- Role or permission changes.
- Live whole-company communications.
- Email-governance changes.
- Directory changes.
- Production configuration changes.

Safeguards may include explicit approval, typed confirmation, reason capture, dependency checks, preview, restricted role, test mode, and durable audit evidence.

## 7. Ticket governance

- Requester-visible replies and internal notes must remain clearly distinct.
- Ticket activity must record participant, action, and timestamp.
- Reopen actions must be explicit and reportable.
- Bulk operations must provide governed confirmation.
- Archive, restore, and permanent deletion must remain separate lifecycle actions.
- Assignee and support-group changes must be auditable.

## 8. Communications governance

- Test recipients and live audiences must be isolated.
- Whole-company, department, management, position, exclusions, and external recipients must be resolved transparently.
- Test or development validation must not contact live audiences.
- Delivery status, intended recipient, provider, timestamp, and failure evidence should be retained.
- Environment email redirects must be visible in operational evidence.

## 9. Directory governance

Microsoft Directory synchronisation must not perform writes when an account has no changes. Actual account changes should be consolidated into Monday 08:00 weekly alerts with actor details and attached to the governed weekly reporting process.

## 10. Audit requirements

Significant activity should record:

- Actor or system identity.
- Action.
- Target entity.
- Before and after state where appropriate.
- Timestamp.
- Reason or approval evidence.
- Result or failure.
- Related ticket, campaign, request, or user reference.

## 11. Segregation and least privilege

- Default to minimum necessary access.
- Separate request, approval, and high-impact execution where practical.
- Do not infer authorisation from job title alone.
- Keep temporary access time-bound.
- Revoke obsolete access through governed controls.
- Review privileged access and role definitions regularly.

## 12. Governance validation checklist

Before releasing a governed function:

1. Test an authorised user.
2. Test an unauthorised user.
3. Test an out-of-scope user.
4. Confirm backend rejection.
5. Confirm frontend explanation.
6. Confirm audit evidence.
7. Confirm notifications.
8. Confirm rollback or recovery behaviour.
9. Confirm no unintended email or directory write.
10. Update trackers and documentation.
