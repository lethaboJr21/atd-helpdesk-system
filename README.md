# ATD Alliance IT Helpdesk Portal

Full-stack IT helpdesk management system for **portal.atdalliance.co.za** — React frontend, Node.js/Express API, PostgreSQL database, deployed behind a PHP web server.

---

## Project Structure

```
atd-helpdesk/
├── frontend/          React + Vite + Tailwind CSS dashboard
│   └── src/
│       ├── App.jsx          Routing + auth guard
│       ├── Dashboard.jsx    Main helpdesk UI (live API)
│       ├── LoginPage.jsx    JWT login screen
│       ├── AuthContext.jsx  Auth state provider
│       └── api.js           Axios API client
├── backend/           Node.js + Express REST API
│   └── src/
│       ├── server.js        Entry point
│       ├── db/
│       │   ├── pool.js      PostgreSQL connection
│       │   ├── migrate.js   Schema migration
│       │   └── seed.js      Demo data + admin user
│       ├── middleware/
│       │   └── auth.js      JWT verification
│       └── routes/
│           ├── auth.js      Login / logout / me
│           ├── tickets.js   Full ticket CRUD
│           └── stats.js     Dashboard KPIs + charts
├── database/
│   └── setup.sql      PostgreSQL user + DB creation
├── proxy.php          PHP reverse proxy → Node.js
├── .htaccess          Apache routing rules
└── .github/workflows/
    └── ci.yml         GitHub Actions CI/CD
```

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Git

### 1. Clone & install
```bash
git clone https://github.com/YOUR_ORG/atd-helpdesk.git
cd atd-helpdesk
npm run install:all
```

### 2. Configure the database
```bash
# As postgres superuser:
psql -U postgres -f database/setup.sql

# Edit the password in the SQL first!
```

### 3. Configure environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your DB credentials and a new JWT_SECRET
```

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Run migrations and seed
```bash
npm run migrate
npm run seed
# Default admin: admin@atdalliance.co.za / Admin@ATD2024!
# ⚠️ Change this password immediately!
```

### 5. Start development servers
```bash
# Terminal 1 – backend API on :3001
npm run dev:backend

# Terminal 2 – frontend dev server on :5173 (proxies /api to :3001)
npm run dev:frontend
```

Open http://localhost:5173

---

## Production Deployment on portal.atdalliance.co.za (PHP Server)

### Architecture
```
Browser → Apache/PHP (port 80/443)
             ├─ /api/* → proxy.php → Node.js :3001
             └─ /*     → proxy.php → React SPA (dist/index.html)
```

### Step 1 – Server prerequisites
```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 (Node.js process manager)
sudo npm install -g pm2

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
```

### Step 2 – PostgreSQL setup
```bash
sudo -u postgres psql -f /var/www/atd-helpdesk/database/setup.sql
```

### Step 3 – Clone the project
```bash
sudo mkdir -p /var/www/atd-helpdesk
sudo chown $USER:$USER /var/www/atd-helpdesk
git clone https://github.com/YOUR_ORG/atd-helpdesk.git /var/www/atd-helpdesk
```

### Step 4 – Configure environment
```bash
cp /var/www/atd-helpdesk/backend/.env.example /var/www/atd-helpdesk/backend/.env
nano /var/www/atd-helpdesk/backend/.env
# Fill in: DB credentials, JWT_SECRET, CORS_ORIGIN=https://portal.atdalliance.co.za
```

### Step 5 – Install, migrate, build
```bash
cd /var/www/atd-helpdesk
npm run install:all
npm run migrate
npm run seed        # Creates admin user + demo data
npm run build       # Builds React into frontend/dist/
```

### Step 6 – Start Node.js with PM2
```bash
cd /var/www/atd-helpdesk/backend
pm2 start src/server.js --name atd-helpdesk-api
pm2 save
pm2 startup        # Follow the printed command to auto-start on reboot
```

### Step 7 – Deploy to PHP web root
```bash
# Copy files to your PHP web root for portal.atdalliance.co.za
WEBROOT=/var/www/html/portal   # Adjust to your actual web root

rsync -av --delete /var/www/atd-helpdesk/frontend/dist/ $WEBROOT/dist/
cp /var/www/atd-helpdesk/proxy.php $WEBROOT/
cp /var/www/atd-helpdesk/.htaccess $WEBROOT/

# Ensure Apache has mod_rewrite and mod_headers enabled
sudo a2enmod rewrite headers
sudo systemctl restart apache2
```

### Step 8 – Verify
```bash
# API health check
curl https://portal.atdalliance.co.za/api/health

# Should return: {"status":"ok","ts":"..."}
```

---

## GitHub Actions CI/CD (Automated Deployment)

Add these secrets in **GitHub → Settings → Secrets → Actions**:

| Secret | Value |
|--------|-------|
| `DEPLOY_HOST` | Your server IP or hostname |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_SSH_KEY` | Contents of your private SSH key |

On every push to `main`, the pipeline:
1. Builds the React frontend
2. Tests the backend with a real PostgreSQL instance
3. Deploys via SSH, rebuilds, and reloads PM2

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login → returns JWT |
| GET  | `/api/auth/me`    | Current user (auth required) |
| POST | `/api/auth/logout`| Logout (auth required) |

### Tickets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/tickets` | List tickets (filterable: `?category=&search=&status=&priority=`) |
| GET    | `/api/tickets/:id` | Single ticket |
| POST   | `/api/tickets` | Create ticket |
| PUT    | `/api/tickets/:id` | Update ticket |
| PATCH  | `/api/tickets/:id/close` | Close ticket |

### Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats/dashboard` | KPI cards |
| GET | `/api/stats/volume` | 7-day bar chart data |
| GET | `/api/stats/sla-trend` | Hourly SLA line chart |
| GET | `/api/stats/categories` | Pie chart data |
| GET | `/api/stats/assets` | Asset health list |

---

## PHP Version (Alternative)

A pure PHP + MySQL/PostgreSQL version of this application is available in the `php-version` branch. It replaces the Node.js API with PHP scripts while keeping the same React frontend and database schema. Run `git checkout php-version` to access it.

---

## Security Notes

- JWT tokens expire after 8 hours
- Login endpoint is rate-limited (20 requests / 15 min)
- All API routes are rate-limited (200 req/min)
- Passwords are hashed with bcrypt (12 rounds)
- CORS is restricted to your domain via `CORS_ORIGIN` in `.env`
- **Change the default admin password immediately after deployment**

---

© ATD Alliance · portal.atdalliance.co.za
