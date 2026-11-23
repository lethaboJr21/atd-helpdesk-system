# ATD Helpdesk Employee Experience

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Status:** Employee experience reference
- **Generated marker:** `ATD-DOCS-GROUP-3-SCRIPT-588`

## 1. Purpose

This guide describes the employee-facing ATD Helpdesk experience. Actual visibility depends on the current user's account status, department, default access, roles, direct permissions, and governed entitlements.

## 2. Signing in and first access

Employee access may include account registration, approval, authentication, terms acceptance, and first-login onboarding. The system should provide clear guidance when an account is awaiting approval, missing required acceptance, or not authorised for a requested function.

Employees should not be shown administrative actions merely because a frontend route is known. The backend remains authoritative for access.

## 3. Employee landing page

The employee landing experience should provide a concise view of authorised functions, including:

- Create a request or ticket.
- Review personal requests.
- View relevant announcements.
- Open notifications and pending actions.
- Access permitted knowledge and catalogue functions.
- Use pinned or configured dashboard actions.
- Review profile and appearance settings.

Company announcements may target the whole company, selected departments, management levels, combined position levels, exclusions, or authorised external recipients. Only announcements matching the current employee audience should appear.

## 4. Creating a request

An employee should select the appropriate incident or service-request path and supply enough information for effective routing. The request experience may include:

- Subject and description.
- Service category or request type.
- Priority or impact information where permitted.
- Department and requestor context.
- Attachments.
- Optional collaborators or employee CC recipients when implemented.

After submission, the employee should receive a durable reference and be able to review the request status.

## 5. Tracking requests

Employees should be able to review authorised ticket information, including:

- Ticket reference and subject.
- Creation date.
- Current status.
- Effective assignee or support group where permitted.
- Deadline or SLA information where appropriate.
- Requester-visible conversation.
- Attachments available to the requester.
- Resolution and closure information.

Internal notes, restricted audit evidence, and administrative metadata must not be exposed.

## 6. Replies and attachments

Employee replies become part of the requester-visible conversation and should retain participant and timestamp information. Attachments must be authorised, path safe, and associated with the correct ticket.

Supported attachments may be previewed inline or in full-screen view where implemented. Download access must be revalidated when the file is opened.

## 7. Resolution, surveys, and reopening

When a ticket is resolved, the employee should receive the applicable solution and status update. Resolved and closed surveys are planned compulsory capabilities and must not be described as deployed until validated.

If the issue reappears, an eligible employee must be able to reopen the resolved ticket. Reopening must create a distinct activity record and preserve the earlier resolution.

## 8. Notifications

Employees may receive notifications for request updates, replies, approvals, assignments relevant to the employee, solution content, service categories, task discussions, and journey events where implemented.

Marking a notification as read must not complete or remove a pending action. Pending actions must remain available until completed, rejected, expired, or superseded through governed processing.

## 9. Company announcements

Authorised announcements may appear on the employee landing page. An announcement may include content, attachments, publication information, and an optional governed conversation.

Portal announcement presentation follows portal themes. Email copies use independent Outlook-compatible ATD branding and do not use Glassmorphism.

## 10. Profile and avatar

Employees should be able to review and update supported profile information. The current profile image should load consistently across authorised portal surfaces, refresh after change, avoid stale cached images, and provide a suitable fallback.

Profile media endpoints must enforce current-user and authorised administrative access.

## 11. Appearance and layout

Employee appearance settings may include:

- Light and Dark modes.
- Colour or appearance themes.
- Glassmorphism as an optional portal theme and layout style.
- Named custom dashboard-layout templates.
- Responsive dashboard arrangements.
- Reduced-transparency or no-blur fallbacks.

Glassmorphism applies only to portal styling. Glassmorphism does not apply to emails.

## 12. Access requests

Employees may request additional functions through the governed access-request workflow. Functions already available should be greyed out. Granted access should appear in a separate view with the grant source, such as default, permission, or role.

The request should include a business reason and should remain traceable through approval, rejection, expiry, or revocation.

## 13. Knowledge and service catalogue

The employee experience may expose authorised knowledge content, solution articles, service categories, catalogue items, and guided request paths. The system should direct employees toward an appropriate request type without blocking legitimate ticket creation when assistance is still required.

Production line reports are limited to active Network catalogue items in IT or active line-issue items in PDM. These tickets are routed automatically to the appropriate support group. A Production operator may report a PDM issue for a supervisor only when the supervisor cannot access their email account, and the reason must be recorded. Finance ticket requesters may link an active employee KPI or skip KPI linking and provide an issue summary; linked KPIs remain visible in the Finance ticket register.

## 14. Privacy and safe use

Employees should:

- Avoid placing passwords or secrets in tickets.
- Include only the necessary personal or business information.
- Use requester replies for communication intended for support and authorised participants.
- Review attachment contents before upload.
- Report incorrect access or unintended information exposure.

## 15. Employee validation checklist

1. Sign in and complete first-access requirements.
2. Review the employee landing page.
3. Create each authorised request type.
4. Track, reply to, and attach files to a request.
5. Confirm internal information is not exposed.
6. Review notifications and pending actions.
7. Review announcements and attachments.
8. Update profile and avatar.
9. Change supported appearance settings.
10. Submit and track an access request.
11. Resolve and reopen an eligible ticket.
12. Validate responsive behaviour on supported screen sizes.
