# ATD Alliance IT Helpdesk & Production Portal

Enterprise support and production operations portal for **portal.atdalliance.co.za**.

The platform is a full-stack application built with:

- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** Node.js, Express
- **Database:** PostgreSQL
- **Process manager:** PM2
- **Web server:** Apache reverse proxy
- **Deployment source:** Work GitLab repository

The live portal is split into two public modules:

```txt
Helpdesk:   https://portal.atdalliance.co.za/helpdesk
Production: https://portal.atdalliance.co.za/production
```

---

## Current Production Status

```txt
Frontend build                     Working
Apache /helpdesk route             Working
Apache /production route           Working
Backend API on Node.js 20          Working
Backend process via PM2            Working
PostgreSQL database                Working
API health through Apache proxy    Working
```

Health checks:

```bash
curl http://127.0.0.1:3001/api/health
curl http://localhost/helpdesk/api/health
curl http://localhost/production/api/health
```

Expected response:

```json
{
  "ok": true,
  "service": "ATD Helpdesk API",
  "status": "healthy"
}
```

---

## Project Structure

```
atd-helpdesk/
|- frontend/
|  |- src/
|  |  |- App.jsx
|  |  |- main.jsx
|  |  |- pages/
|  |  |  |- Dashboard.jsx
|  |  |  |- LoginPage.jsx
|  |  |  |- SignupPage.jsx
|  |  |  |- TicketWorkspace.jsx
|  |  |  |- TicketDetailPage.jsx
|  |  |  |- AdminUsers.jsx
|  |  |  `- ProductionDashboard.jsx
|  |  |- context/
|  |  |  `- AuthContext.jsx
|  |  `- services/
|  |     `- api.js
|  |- vite.config.js
|  `- package.json
|- backend/
|  |- src/
|  |  |- server.js
|  |  |- db/
|  |  |  |- pool.js
|  |  |  `- migrate.js
|  |  |- middleware/
|  |  |  |- auth.js
|  |  |  `- roles.js
|  |  |- routes/
|  |  |  |- auth.js
|  |  |  |- users.js
|  |  |  |- groups.js
|  |  |  |- tickets.js
|  |  |  |- notifications.js
|  |  |  |- production.js
|  |  |  |- productionEvents.js
|  |  |  `- productionSync.js
|  |  `- services/
|  |     |- email.js
|  |     |- ticketReminders.js
|  |     |- productionSyncScheduler.js
|  |     `- syncBedlinerDailyProduction.js
|  |- .env
|  `- package.json
|- database/
|- .github/workflows/
|  `- ci.yml
`- README.md
```

---

## Public Routes

| Module | URL | Purpose |
|---|---|---|
| Helpdesk | `https://portal.atdalliance.co.za/helpdesk` | IT helpdesk dashboard, tickets, users, notifications |
| Production | `https://portal.atdalliance.co.za/production` | Production dashboard, production logs, shift reporting |
| Helpdesk API | `/helpdesk/api/*` | Apache proxy to Node backend |
| Production API | `/production/api/*` | Apache proxy to Node backend |

Both frontend modules currently use the same React build and backend API.

---

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 14+
- Git

### Install dependencies

```bash
cd atd-helpdesk
npm run install:all
```

Or install individually:

```bash
cd backend
npm install

cd ../frontend
npm install
```

### Backend environment

Create:

```txt
backend/.env
```

Example:

```env
NODE_ENV=development
PORT=3001

JWT_SECRET=replace_with_strong_secret

DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=atd_helpdesk
DB_USER=postgres
DB_PASSWORD=replace_with_password

CORS_ORIGIN=http://localhost:5173
PUBLIC_PORTAL_URL=http://localhost:5173

EMAIL_ENABLED=false
```

Generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Run database migration

```bash
cd backend
node src/db/migrate.js
```

### Start backend

```bash
cd backend
npm run dev
```

Backend runs on:

```txt
http://localhost:3001/api
```

### Start frontend

```bash
cd frontend
npm run dev
```

Frontend runs on:

```txt
http://localhost:5173
```

---

## Frontend Build Notes

The Vite base must remain relative:

```js
base: "./"
```

This is required because the same frontend build is deployed under both:

```txt
/helpdesk
/production
```

If `base` is set to `/helpdesk/`, the production page may load blank because it will try to load assets from:

```txt
/helpdesk/assets/...
```

instead of relative assets:

```txt
./assets/...
```

---

## Server Deployment

### Important deployment rule

The production server must pull code from the **work GitLab repository only**.

```txt
Server source remote: GitLab
GitHub: optional personal backup only
```

### Server repository remote

On the server:

```bash
cd /var/www/atd-helpdesk
git remote -v
```

Expected:

```txt
origin  https://gitlab.atdalliance.co.za/Jeffrey/ATD-Helpdesk.git (fetch)
origin  https://gitlab.atdalliance.co.za/Jeffrey/ATD-Helpdesk.git (push)
```

If using HTTPS, GitLab may require a Personal Access Token instead of a normal password.

Recommended token scope for server pull:

```txt
read_repository
```

### Pull latest code from GitLab

```bash
cd /var/www/atd-helpdesk
git pull origin main
```

### Backend deployment

```bash
cd /var/www/atd-helpdesk/backend
npm ci --omit=dev
pm2 restart atd-helpdesk-api --update-env
pm2 save
```

If the PM2 process does not exist:

```bash
pm2 start src/server.js --name atd-helpdesk-api --update-env
pm2 save
```

### Frontend deployment

```bash
cd /var/www/atd-helpdesk/frontend
npm ci
npm run build
```

Deploy build to both public folders:

```bash
sudo rsync -av --delete dist/ /var/www/helpdesk/
sudo rsync -av --delete dist/ /var/www/production/

sudo chown -R www-data:www-data /var/www/helpdesk /var/www/production
sudo chmod -R 755 /var/www/helpdesk /var/www/production
sudo systemctl reload apache2
```

Verify frontend asset paths:

```bash
grep -E "assets|helpdesk|production" /var/www/helpdesk/index.html
grep -E "assets|helpdesk|production" /var/www/production/index.html
```

Expected:

```html
<script type="module" crossorigin src="./assets/index-xxxxx.js"></script>
<link rel="stylesheet" crossorigin href="./assets/index-xxxxx.css">
```

---

## Apache Configuration

Apache serves two frontend routes and proxies both API routes to the same backend.

Config file:

```txt
/etc/apache2/conf-available/atd-helpdesk.conf
```

Required modules:

```bash
sudo a2enmod proxy proxy_http rewrite headers
sudo a2enconf atd-helpdesk
sudo apache2ctl configtest
sudo systemctl reload apache2
```

### Helpdesk route

```apache
ProxyPass "/helpdesk/api/" "http://127.0.0.1:3001/api/"
ProxyPassReverse "/helpdesk/api/" "http://127.0.0.1:3001/api/"

RedirectMatch 301 ^/helpdesk$ /helpdesk/
Alias "/helpdesk/" "/var/www/helpdesk/"

<Directory "/var/www/helpdesk">
    Options -Indexes +FollowSymLinks
    AllowOverride None
    Require all granted

    RewriteEngine On
    RewriteBase /helpdesk/

    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /helpdesk/index.html [L]
</Directory>
```

### Production route

```apache
ProxyPass "/production/api/" "http://127.0.0.1:3001/api/"
ProxyPassReverse "/production/api/" "http://127.0.0.1:3001/api/"

RedirectMatch 301 ^/production$ /production/
Alias "/production/" "/var/www/production/"

<Directory "/var/www/production">
    Options -Indexes +FollowSymLinks
    AllowOverride None
    Require all granted

    RewriteEngine On
    RewriteBase /production/

    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /production/index.html [L]
</Directory>
```

---

## PM2 Operations

Check backend:

```bash
pm2 list
pm2 logs atd-helpdesk-api --lines 100
```

Restart backend:

```bash
pm2 restart atd-helpdesk-api --update-env
```

Save PM2 process list:

```bash
pm2 save
```

Enable startup on reboot:

```bash
pm2 startup
```

Run the command printed by PM2.

---

## PostgreSQL Operations

Database name:

```txt
atd_helpdesk
```

Check users:

```bash
sudo -u postgres psql -d atd_helpdesk -c "SELECT id, name, email, role, approved FROM users ORDER BY id LIMIT 20;"
```

Approve admin:

```bash
sudo -u postgres psql -d atd_helpdesk -c "UPDATE users SET role = 'superadmin', approved = true, updated_at = NOW() WHERE LOWER(email) = LOWER('jeffreym@atdalliance.co.za');"
```

Deactivate external-domain users:

```bash
sudo -u postgres psql -d atd_helpdesk -c "UPDATE users SET approved = false WHERE LOWER(email) NOT LIKE '%@atdalliance.co.za';"
```

Run migrations:

```bash
cd /var/www/atd-helpdesk/backend
node src/db/migrate.js
```

---

## Git Workflow

### Local remotes

Recommended local setup:

```txt
gitlab = official work repository
github = personal backup repository
```

Check remotes:

```bash
git remote -v
```

Push to GitLab:

```bash
git push gitlab main
```

Optional backup to GitHub:

```bash
git push github main
```

### Server remote

The server should use only GitLab:

```bash
cd /var/www/atd-helpdesk
git remote -v
```

Expected:

```txt
origin  https://gitlab.atdalliance.co.za/Jeffrey/ATD-Helpdesk.git
```

Pull on server:

```bash
git pull origin main
```

If GitLab asks for password, use a GitLab Personal Access Token with `read_repository` scope.

---

## API Reference

Base URLs:

```txt
https://portal.atdalliance.co.za/helpdesk/api
https://portal.atdalliance.co.za/production/api
```

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login and return JWT |
| GET | `/api/auth/me` | Current authenticated user |
| POST | `/api/auth/signup` | Request account access |
| POST | `/api/auth/logout` | Logout |

### Users

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users` | List users |
| PUT | `/api/users/:id/approve` | Approve user and set role |
| PUT | `/api/users/:id/role` | Update role |
| PUT | `/api/users/:id/deactivate` | Deactivate user |
| PUT | `/api/users/:id/reactivate` | Reactivate user |

### Tickets

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tickets` | List tickets |
| GET | `/api/tickets/:id` | Get single ticket |
| POST | `/api/tickets` | Create ticket |
| PUT | `/api/tickets/:id` | Update ticket |
| PATCH | `/api/tickets/:id/status` | Update status |
| PATCH | `/api/tickets/:id/resolve` | Resolve ticket |
| PATCH | `/api/tickets/:id/close` | Close ticket |
| POST | `/api/tickets/:id/assign` | Assign ticket |

### Groups

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/groups` | List support groups and members |

### Notifications

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/notifications?module=helpdesk` | List notifications |
| PATCH | `/api/notifications/:id/read` | Mark one notification as read |
| PATCH | `/api/notifications/read-all?module=helpdesk` | Mark module notifications read |
| DELETE | `/api/notifications/clear?module=helpdesk` | Clear notifications |

### Production

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/production` | List production records |
| POST | `/api/production` | Create production record |
| GET | `/api/production-events` | List production events |
| POST | `/api/production-events` | Create production event |
| GET | `/api/production/sync/bedliner-daily` | Daily Bedliner sync data |
| POST | `/api/production/sync/sync-bedliner-daily` | Trigger Bedliner sync |
| GET | `/api/production/sync/test-mssql` | Test MSSQL connection |

---

## Security Notes

- JWT-based authentication is currently active.
- Passwords are hashed with bcrypt.
- Backend should run behind Apache reverse proxy only.
- Express must trust Apache proxy:

```js
app.set("trust proxy", 1);
```

- `.env` must never be committed.
- Rotate secrets if exposed during deployment.
- Restrict active users to `@atdalliance.co.za`.
- Use GitLab Personal Access Tokens for server pulls instead of normal passwords.

---

## Active Roadmap

### Deployment

- [x] Deploy `/helpdesk`
- [x] Deploy `/production`
- [x] Configure Apache reverse proxy
- [x] Run backend with PM2
- [x] Restore PostgreSQL data
- [ ] Move server deployment source fully to GitLab
- [ ] Disable GitHub deployment job

### Authentication and Users

- [ ] Pull Microsoft 365 users via Microsoft Graph
- [ ] Add Microsoft Entra SSO with MSAL
- [ ] Restrict active access to `@atdalliance.co.za`
- [ ] Add local password reset for non-SSO users
- [ ] Admin users get full portal access
- [ ] Standard users can lodge service requests and report problems only

### Helpdesk

- [ ] Add Helpdesk landing page with:
  - Report a Problem
  - Request a Service
- [ ] Default Ticket Workspace to unresolved tickets
- [ ] Flag unassigned tickets clearly
- [ ] Add hover/pinnable ticket grouping sidebar
- [ ] Single-click ticket preview
- [ ] Double-click to open ticket detail

### Notifications

- [ ] Separate Helpdesk and Production notifications
- [ ] Click notification to navigate to source action
- [ ] Mark notification as read after viewing
- [ ] Close notification dropdown when clicking outside
- [ ] Ticket notification includes ticket link
- [ ] Ticket notification shows attachment indicator if applicable

### Production

- [ ] Improve shift dashboard
- [ ] Show quantity produced per shift
- [ ] Filter production by selected shift
- [ ] Add report builder and exports
- [ ] Fix MSSQL DNS/connectivity for Bedliner sync

### GLPI-Inspired Improvements

- [ ] Service catalog
- [ ] Incident vs service request separation
- [ ] Problem management
- [ ] Knowledge base
- [ ] Asset links / CMDB-style relationships
- [ ] SLA and escalation improvements
- [ ] Audit trail/history improvements

---

## Troubleshooting

### Blank `/production` page

Check asset paths:

```bash
grep -E "assets|helpdesk|production" /var/www/production/index.html
```

If it shows `/helpdesk/assets/...`, rebuild with:

```js
base: "./"
```

Then redeploy:

```bash
cd /var/www/atd-helpdesk/frontend
npm run build
sudo rsync -av --delete dist/ /var/www/production/
```

### API returns 503

Check backend:

```bash
pm2 list
curl http://127.0.0.1:3001/api/health
```

### Login returns 500

Check backend logs:

```bash
pm2 logs atd-helpdesk-api --lines 100
```

### GitLab pull fails with HTTP Basic Access Denied

Use a GitLab Personal Access Token instead of password.

Required scope:

```txt
read_repository
```

### GitLab SSH hangs

The GitLab hostname may resolve through Cloudflare and SSH port 22 may be blocked. Use HTTPS with token or an internal GitLab SSH address.

---

## Maintainer

**Jeffrey Motepe**
ATD Alliance IT Helpdesk / Production Portal

---

(c) ATD Alliance | portal.atdalliance.co.za
# Refined Production Frontend Files

Replace:
- `frontend/src/App.jsx`
- `frontend/src/pages/EmployeeDashboard.jsx`
- `frontend/src/pages/AdminSettings.jsx`
- `frontend/src/pages/AdminUsers.jsx`

Validation:
```powershell
cd frontend
npm run build
```

AdminUsers improvements:
- Floating toast notifications that automatically close after 5 seconds
- No top-of-page success/error blocks
- Scroll position preserved after edits/actions
- Row selection and select-all-visible
- Bulk approve, activate, deactivate, archive, restore, and role assignment
- 50, 100, 200, or All employee views
- Pagination for 50/100/200 views

<!-- SCRIPT-207-PRODUCTION-STATUS-START -->
## Production Release Status: 2026-09-01

### Active release
- Release: atd-helpdesk-runtime-release-20260901-090118
- Archive SHA-256: 9A6763700789CED96E030DB526CF10113B95DD938D84F79A600E274C82AD1E5D
- Public index SHA-256: 578A308C6FEF2BED7D7028862F348D136E0A1FF5F7C1D6FD586DC615C3E9F90D
- Backend process: atd-helpdesk-api, validated online on PID 1164117
- Production validation: 18 passes, 10 warnings, 0 failures
- Rollback backup: /home/atdadmin/atd-helpdesk-backups/pre-release-20260901-091236

### Deployment outcome
The controlled production deployment completed successfully. The runtime package contained 327 files with zero prohibited matches. The production .env, runtime storage, existing backend dependencies, PM2 ecosystem configuration and Git metadata were preserved. Apache was not reloaded because its configuration test remains blocked by the missing SSL private key.

The public frontend currently references:

text
static/index-COX_fOTs.js
static/index-Nh_T78Qd.css


The active public routes returned HTTP 200 during consolidated validation:

text
https://portal.atdalliance.co.za/helpdesk/
https://portal.atdalliance.co.za/helpdesk/production
https://portal.atdalliance.co.za/production/
https://portal.atdalliance.co.za/helpdesk/api/health


### Migration record
The following additive migrations were committed in one transaction:

- 2026-08-assignment-acceptance-access-foundation.sql
- 2026-08-email-replies-and-recipient-switching.sql
- 2026-08-first-login-onboarding.sql
- 2026-08-guided-routing-foundation.sql
- 2026-08-priority-sla-policy.sql
- 2026-08-terms-governance.sql
- 191_transaction_safe_undo.sql

The migration 2026-08-corrected-guided-request-routing.sql was intentionally excluded because it contains controlled UPDATE and DELETE statements that affect Support Groups and routing rules. Do not execute it without a separate business-data review and backup plan.

### Current deployment procedure
The release used a controlled package, verified remote backup, isolated staging, additive migration allowlist, backend health cutover, public frontend activation and consolidated production validation. Do not use a blind generic migration run or a broad rsync --delete against the application root.

For the current server:

- Preserve /var/www/atd-helpdesk/backend/.env.
- Preserve /var/www/atd-helpdesk/backend/storage.
- Preserve /var/www/atd-helpdesk/backend/node_modules when dependency files are unchanged.
- Preserve /var/www/atd-helpdesk/backend/ecosystem.config.js.
- Restart the existing PM2 process by application name only.
- Do not reload Apache while configuration testing fails.
- Use /home/atdadmin/atd-helpdesk-backups/pre-release-20260901-091236 for rollback.

### Known limitations and next work
- Controlled production lifecycle-email delivery validation
- Production inbound email-to-ticket validation
- Bedliner DNS resolution for atd-sql01
- Apache SSL private-key repair and successful configtest
- PM2 reboot-persistence repair
- Business-data review of the excluded corrected guided-routing migration
- Consolidated role-based functional milestone testing
- Syspro service-specific response SLA resolver
- Base-less route redirect compatibility
- Survey and background-job validation
- Expanded Undo coverage beyond status and priority
- Dashboard customisation, named layout templates, themes and universal UX batch
- Frontend bundle code splitting and chunk optimisation

### Next validation
Script 208 will run the consolidated role-based functional milestone validation. Infrastructure, route, frontend provenance and database schema checks have passed, but full employee, agent, approver, manager and administrator workflow validation remains outstanding.
<!-- SCRIPT-207-PRODUCTION-STATUS-END -->


## Milestone update 2026-09-07
- Added controlled avatar crop, fit, fill, zoom and modal isolation.
- Added sticky Ticket Monitor headings.
- Added Ticket Workspace List/Kanban, Select mode and current-page selection.
- Added theme-aware semantic priority badges.
- Governed bulk mutations remain deferred until dedicated ticket bulk endpoints exist.

<!-- ATD-MILESTONE-SCRIPT-345-SLA-KANBAN-OVERDUE -->
## Validated SLA, Kanban, and Overdue milestone

- Ticket Workspace uses theme-aware Critical, High, Medium, and Low priority bubbles.
- Kanban cards display assignee, Unassigned fallback, Ticket Due, and an SLA countdown gauge.
- SLA gauge thresholds are green above 50% remaining, orange at or below 50%, red at or below 25%, and overdue at zero.
- Governed Kanban drag-and-drop requires confirmation, uses the protected status endpoint, records activity, and exposes the existing Undo notification.
- Direct drag to Resolved or Closed is blocked so governed completion requirements are not bypassed.
- Kanban column names and ticket counts remain sticky while cards scroll.
- Dashboard SLA Compliance has been replaced by authoritative Overdue Tickets using unresolved tickets with due_at at or before the current time.
- Backend stats syntax and the frontend production build passed on 7 September 2026.
- Deployment remains separate from validation. Reports, backups, release artifacts, and duplicate source files must not be committed.

### Deferred after this deployment

- Governed multi-ticket mutation endpoints and Dashboard Priority queue bulk operations.
- Requestor Department and expanded reusable filters.
- Company and Department announcement feeds, discussions, comments, checklists, email delivery, unread alerts, and persistent notification actions.
- Microsoft Directory no-change journal and Monday 08:00 weekly report attachment.
- Cartoon avatar library and announcement identity cards.
<!-- BEGIN 514 TICKET WORKSPACE ATTACHMENT HOD -->
## Ticket Workspace, Preview, Attachment, and HOD Role Update

**Recorded:** 2026-09-14
**Status:** Source discovery and implementation preparation

### Approved requirements

- Expand the Ticket Workspace panel to use the complete available content area after the sidebar and application header.
- Selecting a ticket must automatically open the ticket preview and load the selected ticket.
- A second separate single click on the same selected ticket must show a compact instruction: **Double-click the ticket to open the full ticket.**
- A true double-click must immediately open the full ticket without a conflicting instructional popup.
- Restore attachment selection through the file picker in addition to existing drag-and-drop behavior.
- Use one shared attachment validation and upload path for dropped and browsed files.
- Reset the file input after processing so the same file can be selected again.
- Add **HOD** to user-role selection and carry the role through frontend typing, validation, API validation, backend role handling, authorization, audit history, filtering, and database constraints or reference data where applicable.

### Guardrails

- Preserve existing ticket routing, filters, List/Kanban behavior, bulk actions, pagination, and ticket access controls.
- Do not assign HOD permissions by assumption. Use the repository's existing role-permission model.
- Back up every modified application file before implementation.
- Validate frontend build, backend build, migrations, attachment selection, drag-and-drop, single-click preview, double-click navigation, and HOD user create/edit flows before deployment.
- Produce one consolidated UTF-8 TXT implementation report in the repository
eports folder.

### Source collection

Run from the repository root:

`powershell
powershell -ExecutionPolicy Bypass -File .\scripts\514_collect_ticket_workspace_attachment_hod_sources.ps1
`

The script writes complete source contents to:

`	ext
reports\514_ticket_workspace_attachment_hod_source_collection.txt
`
<!-- END 514 TICKET WORKSPACE ATTACHMENT HOD -->
<!-- BEGIN 515 TICKET WORKSPACE ATTACHMENT HOD IMPLEMENTATION -->
## Ticket Workspace, Attachment Picker, and HOD Role Implementation

- Ticket Workspace now consumes the complete available content width when no ticket is selected.
- Selecting a ticket automatically opens and refreshes the preview panel.
- A second separate single click on the same ticket shows guidance to double-click for the full ticket.
- A true double-click opens the full ticket and clears the guidance message.
- Attachment browse/select is explicitly connected to the native file input and resets after upload; existing drag-and-drop behavior is preserved.
- HOD is available as a selectable user role using stored value `hod` and display label `HOD`.
- HOD is not automatically treated as a Helpdesk operations role. Existing governed permissions continue to control access.
- Script 515 creates backups and one consolidated implementation report under `reports`.
<!-- END 515 TICKET WORKSPACE ATTACHMENT HOD IMPLEMENTATION -->
