# ATD Helpdesk Frontend Architecture

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-5-SCRIPT-590`


## 1. Purpose

The frontend provides the browser experience for employees, agents, managers, administrators, and other authorised users. The verified architecture uses React with Vite and consumes backend REST APIs under the application API boundary.

## 2. Responsibilities

- Route and page composition.
- Role-aware navigation and workspace presentation.
- Forms, tables, cards, queues, filters, dialogs, previews, and dashboards.
- Notification and activity interactions.
- Local presentation state and safe refresh behaviour.
- API requests through shared service clients.
- Responsive and accessible portal styling.

Frontend visibility is not an authorisation boundary. Every governed action must still be validated by the backend.

## 3. Application structure

The active `frontend/src` tree is the primary frontend source. Historic releases, generated distributions, reports, and backup copies are secondary evidence.

Typical layers include:

- Application entry and route composition.
- Page-level components.
- Reusable feature components.
- Dashboard and ticket components.
- Shared API services.
- Authentication and current-user context.
- Theme, profile, and preference handling.
- Utility functions and shared styling.

## 4. Routing

Protected routes should resolve the current user before presenting governed content. Deep links must survive browser refresh and return users safely after authentication. The portal base path must remain consistent with production routing.

Back to Admin and Back to Dashboard controls should be standardised across relevant pages.

## 5. State management

State should be kept as close as practical to the feature that owns it. Shared or persistent state may include authentication, current profile, themes, notification counts, dashboard layouts, and authorised preferences.

Live refresh should preserve filters, drafts, selections, active ticket context, and scroll position where supported.

## 6. API client

Shared API clients should provide a consistent base URL, credentials or token handling, error normalisation, timeouts, and response processing. Long-running server work should return an accepted operation rather than depend on one browser request remaining open.

A client timeout does not prove that server processing failed. UI messages must distinguish timeout, accepted processing, completed work, and failed work.

## 7. Error handling

User-facing errors should be concise and actionable. Repeated failures from one click must not create duplicate banners and toasts.

### Known priority defect

Notification Centre assignment alerts currently show valid-looking ticket references but the Open action reports: `This notification does not contain a valid ticket action.` This requires payload/reference repair and a safe ticket-opening fallback immediately after documentation.

## 8. Tickets and workspaces

Ticket pages and components should support list and detail views, broad filtering, assignment, activity, replies, internal notes, attachments, archive lifecycle, priority queues, bulk actions, and authorised previews.

## 9. Dashboards

Dashboard components may provide widgets, templates, announcements, priority queues, ticket previews, statistics, and layout customisation. Named custom layouts should be managed with themes and appearance preferences.

## 10. Themes and Glassmorphism

Glassmorphism is an optional portal theme and layout style only. The portal should use restrained transparency, accessible contrast, responsive surfaces, and fallback behaviour when blur or transparency is unavailable. Glassmorphism must not be applied to email templates.

## 11. Accessibility and responsiveness

- Preserve keyboard access and visible focus.
- Use semantic controls and labels.
- Maintain sufficient contrast.
- Avoid decorative effects that impair readability.
- Support desktop, tablet, and mobile layouts.
- Provide alternatives to hover-only interactions.

## 12. Frontend validation

1. Run the production build.
2. Validate route refresh and authentication return paths.
3. Test each role and unauthorised path.
4. Validate responsive layouts.
5. Validate Light/Dark and supported themes.
6. Validate error, empty, loading, and partial states.
7. Validate filters, drafts, selection, and refresh preservation.
8. Validate attachment previews and downloads.
9. Validate Notification Centre navigation and governed actions.
10. Confirm no live email is triggered during UI validation.
