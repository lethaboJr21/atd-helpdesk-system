# ATD Helpdesk Deployment and Operations

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-5-SCRIPT-590`


## 1. Purpose

Deployment is a governed process that moves a validated milestone to the server while preserving backup, migration, activation, health, and rollback evidence.

## 2. Milestone model

Feature testing is deferred until the development milestone is complete. The milestone then receives one comprehensive test, one controlled server push, and one consolidated report covering the milestone changes.

## 3. Predeployment checks

- Confirm scope and tracker status.
- Confirm the exact commit and branch.
- Review the working tree and exclude unrelated files.
- Run frontend and backend validation.
- Review migrations.
- Verify environment and email safety.
- Prepare server and database backups.
- Define rollback and acceptance criteria.

## 4. Git discipline

Stage only the intended milestone files. Do not broadly stage backups, reports, generated distributions, secrets, or unrelated local changes. Record the exact commit pushed to the controlled branch.

## 5. Server deployment

A controlled deployment may include:

1. Verify remote identity and paths.
2. Capture application and database backups.
3. Fetch or stage the exact release.
4. Install verified dependencies.
5. Apply approved migrations.
6. Build or activate frontend assets.
7. Restart the managed backend process.
8. Validate health and application routes.
9. Verify production state and logs.
10. Retain rollback evidence.

## 6. Process management

The production Node.js service is managed through the approved process manager. Restart and health evidence should identify the application, process state, start time, and final health result without exposing secrets.

## 7. Reverse proxy and deep links

The web server must support the portal base path, API proxying, static assets, and single-page application deep-link fallback. Authentication return paths and browser refresh must remain functional.

## 8. Migration handling

Migrations require a verified target database, backup, ordered execution, failure handling, and post-migration checks. A partial migration or activation must be diagnosed before repeated deployment attempts.

## 9. Postdeployment validation

- Sign in with appropriate test roles.
- Validate landing pages and routes.
- Validate ticket and notification critical paths.
- Validate attachments and static assets.
- Validate database and migration state.
- Validate scheduled work without live side effects.
- Review logs and health.
- Compare deployed commit and expected assets.

## 10. Rollback

Rollback may require application release restoration, frontend asset restoration, process restart, configuration restoration, and database recovery. Database rollback must follow the approved migration and backup strategy.

## 11. Operational reporting

The milestone report should identify scope, scripts, files, validation, commit, deployment, migrations, production checks, unresolved issues, rollback evidence, and tracker updates.

## 12. Current priority after documentation

Repair the production Notification Centre defect where assignment-alert Open actions report an invalid ticket action. The repair must be source collected, guarded, validated, deployed, and included in the next operational report.
