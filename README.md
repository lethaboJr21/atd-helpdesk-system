# ATD Alliance Helpdesk and Operations Portal

The ATD Alliance portal is an enterprise support, employee-service, communications, and operational reporting platform. It combines governed ticket management, employee self-service, support operations, administration, knowledge, company communications, production visibility, and Microsoft-integrated email capabilities in one full-stack application.

## Portal addresses

```text
Helpdesk:   https://portal.atdalliance.co.za/helpdesk/
Production: https://portal.atdalliance.co.za/production/
API health: https://portal.atdalliance.co.za/helpdesk/api/health
```

The current frontend build uses `/helpdesk/` as its Vite base and writes generated assets to `static/`.

## Platform scope

### Employee experience

- Report incidents and request services through guided entry points.
- View personal tickets, pending actions, announcements, and company communications.
- Open ticket previews, attachments, activity, conversations, and full ticket records.
- Use governed access requests and employee experience workflows.
- Manage profile media and appearance preferences.

### Helpdesk and operations

- List and Kanban ticket workspaces with filters, previews, selection, and governed actions.
- Assignment acceptance, support-group routing, SLA visibility, archive rules, reopen tracking, and ticket statistics.
- Priority queues, dashboard configuration, employee dashboard snapshots, and operational monitoring.
- Notification Centre, activity tracking, knowledge articles, catalogue services, and workspace management.
- Company Communications scheduling, audience targeting, delivery tracking, and history.

### Administration and governance

- User, role, support-group, permission, access-request, settings, and administrative control routes.
- JWT authentication, password hashing, CORS allowlisting, Helmet security headers, rate limiting, and governed API access.
- PostgreSQL migrations, controlled archive behaviour, audit-oriented workflows, and protected production deployment procedures.

### Integrations and background services

- Microsoft Graph email through MSAL, including provider verification and controlled sending.
- Email-to-ticket intake scheduler, which can be enabled or disabled by environment configuration.
- Socket.IO for real-time application communication.
- Ticket reminder, production synchronisation, email intake, and Company Communications background jobs.
- MSSQL production integration for Bedliner data. Development connectivity depends on DNS and network access to `atd-sql01`.

## Technology stack

### Frontend

- React 18
- Vite 5
- React Router 6
- Tailwind CSS 3
- Axios
- Framer Motion
- Recharts
- Lucide React
- Socket.IO client

### Backend

- Node.js and Express 4
- PostgreSQL through `pg`
- Microsoft Graph authentication through `@azure/msal-node`
- Socket.IO
- MSSQL integration
- JWT and bcrypt
- Helmet, CORS, and Express rate limiting
- Multer and Sharp for uploaded and profile media
- Node cron scheduling

### Production runtime

- Apache reverse proxy and static frontend hosting
- PM2-managed Node.js API
- PostgreSQL database
- GitLab as the official work repository

## Current architecture

```text
Browser
  -> Apache public routes
     -> React/Vite frontend under /helpdesk/
     -> /api requests proxied to Node.js
        -> Express routes and middleware
        -> PostgreSQL
        -> Microsoft Graph
        -> MSSQL production source
        -> scheduled background services
        -> Socket.IO
```

Major backend route groups include authentication, terms, employee experience, request routing, assignment acceptance, operational monitoring, access requests, tickets, statistics, logs, notifications, groups, Microsoft integration, users, settings, administrative controls, assets, workspaces, company communications, catalogue, email intake, archives, archive rules, production, knowledge, and profile media.

## Repository structure

```text
atd-helpdesk/
|- frontend/
|  |- src/
|  |  |- components/
|  |  |- context/
|  |  |- pages/
|  |  |- services/
|  |  `- App.jsx
|  |- package.json
|  `- vite.config.js
|- backend/
|  |- src/
|  |  |- db/
|  |  |- middleware/
|  |  |- routes/
|  |  |- services/
|  |  `- server.js
|  `- package.json
|- database/
|- docs/
|- scripts/
|- reports/
|- .github/workflows/
|- package.json
`- README.md
```

Backups, release copies, reports, generated builds, source-collection files, and `node_modules` are not active application source and must not be included casually in commits or deployment packages.

## Local development

### Prerequisites

- Node.js 20 or later
- npm 10 or later
- PostgreSQL 14 or later
- Git

### Install dependencies

From the repository root:

```powershell
npm run install:all
```

### Configure the backend

Create `backend/.env` using approved local secrets and environment-specific connection values. Never commit `.env` files or credentials.

Typical configuration areas include:

```text
NODE_ENV
PORT
JWT_SECRET
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
CORS_ORIGIN
PUBLIC_PORTAL_URL
EMAIL_PROVIDER and Microsoft Graph credentials
DISABLE_BACKGROUND_JOBS
SERVE_FRONTEND_FROM_NODE
```

### Database setup

Run migrations only after reviewing the migration set and confirming the target database and backup position:

```powershell
npm run migrate
```

Optional development seed:

```powershell
npm run seed
```

Do not run data-changing migrations blindly in production. Business-data migrations require their own review, backup, validation, and rollback plan.

### Start the backend

Use a dedicated terminal from the repository root:

```powershell
npm run dev:backend
```

The default local API is:

```text
http://localhost:3001/api
```

### Start the frontend

Use a separate terminal from the repository root:

```powershell
npm run dev:frontend
```

The Vite development server uses:

```text
http://localhost:5173
```

The development proxy forwards `/api` requests to `http://localhost:3001`.

## Build and validation

Build the frontend:

```powershell
npm run build
```

Validate a changed backend JavaScript file:

```powershell
node --check .\backend\src\path\to\file.js
```

Check the backend health endpoint:

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

Before a milestone push or deployment, use the milestone's consolidated validation script. Feature testing is performed after the milestone implementation is complete, followed by one consolidated report and controlled server push.

## Frontend routing and build output

The current Vite configuration uses:

```javascript
base: "/helpdesk/"
build.assetsDir: "static"
```

Do not replace the base path with older relative-base guidance without validating every public route and deployment target. The `/helpdesk` route is redirected to `/helpdesk/`, and the `static/` asset directory avoids collision with an application `/assets` route.

## Security and access control

- Authentication uses JWT tokens and bcrypt password hashing.
- Express trusts one reverse proxy hop in production topology.
- CORS origins are explicitly allowlisted.
- Login and general API rate limits are enabled.
- Helmet security headers are enabled.
- Profile media routes require authentication.
- Access depends on governed roles, permissions, support groups, and entitlements.
- Environment files, tokens, passwords, certificates, and private keys must never be committed.
- Actual Microsoft Directory changes must be governed and reported; unchanged accounts must not generate writes.

## Deployment governance

The official deployment source is the ATD Alliance GitLab repository. Production deployment is a controlled operation, not a routine development step.

Required safeguards include:

1. Review the complete change set and exclude backups, reports, generated files, and source-collection artefacts.
2. Create a verified server-side backup and record rollback paths.
3. Preserve production environment files, runtime storage, dependency state when appropriate, PM2 configuration, and Git metadata.
4. Apply only approved migrations with a database backup and rollback plan.
5. Build and validate the frontend before activation.
6. Restart the existing PM2 application by its configured name.
7. Validate private and public health endpoints, role-based workflows, background jobs, and integrations.
8. Produce one consolidated deployment and validation report.

Detailed procedures are maintained in the deployment and operations documentation. Do not use a broad destructive sync against the application root.

## Known environment dependencies

- Bedliner production synchronisation requires network and DNS access to `atd-sql01`.
- Microsoft Graph email requires valid tenant, client, credential, and sender configuration.
- Email-to-ticket intake may be disabled in an environment even when Graph sending is available.
- Apache configuration and SSL material must pass server validation before reload.
- PM2 reboot persistence must be checked separately from application health.
- The frontend build may report a large-chunk advisory; this is a performance optimisation item unless the build exits unsuccessfully.

## Documentation library

The root README is the maintained entry point. Detailed documentation is organised under `docs/`:

- [Documentation index](docs/00_DOCUMENTATION_INDEX.md)
- [System overview](docs/01_SYSTEM_OVERVIEW.md)
- [Functional capability guide](docs/02_FUNCTIONAL_CAPABILITY_GUIDE.md)
- [Technical architecture](docs/03_TECHNICAL_ARCHITECTURE.md)
- [Roles, access, and governance](docs/04_ROLES_ACCESS_AND_GOVERNANCE.md)
- [Ticket lifecycle and workflows](docs/05_TICKET_LIFECYCLE_AND_WORKFLOWS.md)
- [Company Communications](docs/13_COMPANY_COMMUNICATIONS.md)
- [Email-to-ticket and email governance](docs/14_EMAIL_TO_TICKET_AND_EMAIL_GOVERNANCE.md)
- [Microsoft Directory and Graph](docs/15_MICROSOFT_DIRECTORY_AND_GRAPH.md)
- [Deployment and operations](docs/21_DEPLOYMENT_AND_OPERATIONS.md)
- [Troubleshooting and failure modes](docs/22_TROUBLESHOOTING_AND_FAILURE_MODES.md)
- [Security and privacy controls](docs/24_SECURITY_AND_PRIVACY_CONTROLS.md)
- [Known limitations and roadmap](docs/25_KNOWN_LIMITATIONS_AND_ROADMAP.md)
- [Developer onboarding guide](docs/26_DEVELOPER_ONBOARDING_GUIDE.md)

Historical README files under backup and release directories describe their captured release state and are intentionally not updated with the active README.

## Current development position

The active development branch contains ongoing work across ticket assignment acceptance, Company Communications, employee experience, dashboard configuration, ticket statistics, ticket workspaces, profile avatar and account menu parity, attachment and hover previews, archive rules, appearance handling, and related API services.

These local feature changes must remain separate from documentation-only commits unless a governed milestone commit explicitly includes them. The next milestone validation must reconcile the current source state, complete the four-function implementation group, run one comprehensive milestone test, and then produce one consolidated report before deployment.

## Git workflow

Check the current branch and configured remotes before any push:

```powershell
git branch --show-current
git remote -v
git status --short
```

Use selective staging. Do not use broad staging commands when backups, reports, or source collections are present.

```powershell
git add -- README.md
git diff --cached --check
git diff --cached -- README.md
```

The work GitLab remote may be named `gitlab` rather than `origin`. Always use the configured remote and intended branch instead of assuming remote names.

## Maintainer

Jeffrey Motepe

ATD Alliance IT Helpdesk and Operations Portal

---

(c) ATD Alliance | portal.atdalliance.co.za
