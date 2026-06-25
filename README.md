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

```txt
atd-helpdesk/
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── SignupPage.jsx
│   │   │   ├── TicketWorkspace.jsx
│   │   │   ├── TicketDetailPage.jsx
│   │   │   ├── AdminUsers.jsx
│   │   │   └── ProductionDashboard.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   └── services/
│   │       └── api.js
│   ├── vite.config.js
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── db/
│   │   │   ├── pool.js
│   │   │   └── migrate.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── roles.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── users.js
│   │   │   ├── groups.js
│   │   │   ├── tickets.js
│   │   │   ├── notifications.js
│   │   │   ├── production.js
│   │   │   ├── productionEvents.js
│   │   │   └── productionSync.js
│   │   └── services/
│   │       ├── email.js
│   │       ├── ticketReminders.js
│   │       ├── productionSyncScheduler.js
│   │       └── syncBedlinerDailyProduction.js
│   ├── .env
│   └── package.json
│
├── database/
├── .github/workflows/
│   └── ci.yml
└── README.md
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

© ATD Alliance · portal.atdalliance.co.za
