# ATD Helpdesk Access Requests and Entitlements

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-3-SCRIPT-588`

## 1. Purpose

This document describes how additional access should be requested, reviewed, granted, displayed, expired, revoked, and audited.

## 2. Access sources

A user may receive access through:

- Default access.
- Role membership.
- Direct permission.
- Temporary or governed entitlement.
- Another explicitly implemented organisational scope.

The effective-access view should explain the grant source rather than present only a combined list.

## 3. Request catalogue behaviour

When a user opens the access-request experience:

- Functions already available must be greyed out.
- Already granted access must be displayed separately.
- The display must identify whether access came from default, permission, or role.
- Governed grants must remain revocable.
- A user must not request an identical active entitlement unnecessarily.

## 4. Access request content

A request should record:

- Requester.
- Requested function or entitlement.
- Business reason.
- Current access and grant source.
- Requested scope.
- Requested duration where temporary.
- Supporting evidence where applicable.
- Submission timestamp.

The request should avoid collecting unnecessary personal information.

## 5. Review workflow

An authorised reviewer should be able to:

1. Review the requester and organisational context.
2. Review the requested function and scope.
3. See existing access and grant sources.
4. Identify conflicts or duplication.
5. Approve, reject, request information, or apply a narrower entitlement.
6. Set effective and expiry dates where applicable.
7. Record a decision reason.

The backend must revalidate the request state when an action is submitted.

## 6. Actionable notifications

Access approvals or review tasks may appear as actionable notifications. Marking the notification as read must not complete the request or remove the action.

If another reviewer has already decided the request, a stale action should fail safely and show the current result.

## 7. Grant application

Before applying a grant, the system should verify:

- The requester still exists and is eligible.
- The function still exists and is active.
- The access is not already effective through another source.
- The reviewer is authorised for the requested scope.
- Start and expiry dates are valid.
- Conflicting access is handled according to policy.

A successful grant should create durable access and audit evidence.

## 8. Temporary entitlements

Temporary access should include:

- Effective date and time.
- Expiry date and time.
- Scope.
- Approver.
- Reason.
- Automatic or governed expiry processing.
- Expiry notification where configured.
- Audit evidence.

Expiry must not remove unrelated default, role, or direct access.

## 9. Revocation

An authorised revocation should identify the exact grant being removed. Revocation must not remove access supplied independently by another source.

Revocation should record:

- Revoking actor.
- Grant source.
- Affected function and scope.
- Reason.
- Timestamp.
- Effective result.

## 10. Role and direct-permission interaction

A direct permission can coexist with role-based access. The effective-access display should make this clear so that removing one source does not create a false expectation that access has ended.

Administrators should prefer maintainable role-based grants where appropriate and use direct permissions only for justified exceptions.

## 11. Default access

Default access represents baseline functions provided to eligible users. Default functions should still appear in the granted-access view and should be identified as default.

If default access is governed by account type, department, or another organisational attribute, the rule must be documented and tested.

## 12. Segregation of duties

High-risk access may require separate request, approval, and activation responsibilities. A user should not approve their own privileged request unless an explicitly approved emergency process permits it and retains enhanced evidence.

## 13. Audit and reporting

Access reporting should support:

- Pending requests.
- Approved and rejected requests.
- Current direct grants.
- Role-derived access.
- Default access.
- Temporary access and upcoming expiry.
- Revocations.
- Reviewer and decision duration.
- Privileged access.
- Exceptions and conflicts.

## 14. Failure handling

- Duplicate submissions should not create duplicate active grants.
- Partial processing must not report complete success.
- A failed notification must not erase the access decision.
- A failed grant application should preserve the request and failure evidence.
- Retry processing must be idempotent.

## 15. Validation checklist

1. Display existing default, role, and direct access separately.
2. Confirm already available functions are greyed out.
3. Submit a valid request.
4. Reject duplicate or invalid requests.
5. Approve, reject, and request clarification.
6. Validate stale notification actions.
7. Validate temporary start and expiry.
8. Revoke one grant without removing another source.
9. Validate unauthorised review and self-approval restrictions.
10. Reconcile effective access, audit, notifications, and reports.
