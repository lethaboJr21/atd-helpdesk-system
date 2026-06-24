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

# ATD-Helpdesk



## Getting started

To make it easy for you to get started with GitLab, here's a list of recommended next steps.

Already a pro? Just edit this README.md and make it your own. Want to make it easy? [Use the template at the bottom](#editing-this-readme)!

## Add your files

* [Create](https://docs.gitlab.com/user/project/repository/web_editor/#create-a-file) or [upload](https://docs.gitlab.com/user/project/repository/web_editor/#upload-a-file) files
* [Add files using the command line](https://docs.gitlab.com/topics/git/add_files/#add-files-to-a-git-repository) or push an existing Git repository with the following command:

```
cd existing_repo
git remote add origin https://gitlab.atdalliance.co.za/Jeffrey/atd-helpdesk.git
git branch -M main
git push -uf origin main
```

## Integrate with your tools

* [Set up project integrations](https://gitlab.atdalliance.co.za/Jeffrey/atd-helpdesk/-/settings/integrations)

## Collaborate with your team

* [Invite team members and collaborators](https://docs.gitlab.com/user/project/members/)
* [Create a new merge request](https://docs.gitlab.com/user/project/merge_requests/creating_merge_requests/)
* [Automatically close issues from merge requests](https://docs.gitlab.com/user/project/issues/managing_issues/#closing-issues-automatically)
* [Enable merge request approvals](https://docs.gitlab.com/user/project/merge_requests/approvals/)
* [Set auto-merge](https://docs.gitlab.com/user/project/merge_requests/auto_merge/)

## Test and Deploy

Use the built-in continuous integration in GitLab.

* [Get started with GitLab CI/CD](https://docs.gitlab.com/ci/quick_start/)
* [Analyze your code for known vulnerabilities with Static Application Security Testing (SAST)](https://docs.gitlab.com/user/application_security/sast/)
* [Deploy to Kubernetes, Amazon EC2, or Amazon ECS using Auto Deploy](https://docs.gitlab.com/topics/autodevops/requirements/)
* [Use pull-based deployments for improved Kubernetes management](https://docs.gitlab.com/user/clusters/agent/)
* [Set up protected environments](https://docs.gitlab.com/ci/environments/protected_environments/)

***

# Editing this README

When you're ready to make this README your own, just edit this file and use the handy template below (or feel free to structure it however you want - this is just a starting point!). Thanks to [makeareadme.com](https://www.makeareadme.com/) for this template.

## Suggestions for a good README

Every project is different, so consider which of these sections apply to yours. The sections used in the template are suggestions for most open source projects. Also keep in mind that while a README can be too long and detailed, too long is better than too short. If you think your README is too long, consider utilizing another form of documentation rather than cutting out information.

## Name
Choose a self-explaining name for your project.

## Description
Let people know what your project can do specifically. Provide context and add a link to any reference visitors might be unfamiliar with. A list of Features or a Background subsection can also be added here. If there are alternatives to your project, this is a good place to list differentiating factors.

## Badges
On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Visuals
Depending on what you are making, it can be a good idea to include screenshots or even a video (you'll frequently see GIFs rather than actual videos). Tools like ttygif can help, but check out Asciinema for a more sophisticated method.

## Installation
Within a particular ecosystem, there may be a common way of installing things, such as using Yarn, NuGet, or Homebrew. However, consider the possibility that whoever is reading your README is a novice and would like more guidance. Listing specific steps helps remove ambiguity and gets people to using your project as quickly as possible. If it only runs in a specific context like a particular programming language version or operating system or has dependencies that have to be installed manually, also add a Requirements subsection.

## Usage
Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment
Show your appreciation to those who have contributed to the project.

## License
For open source projects, say how it is licensed.

## Project status
If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.
