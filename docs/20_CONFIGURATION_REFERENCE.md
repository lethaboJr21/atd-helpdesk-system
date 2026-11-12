# ATD Helpdesk Configuration Reference

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-5-SCRIPT-590`


## 1. Purpose

This document defines configuration categories without exposing secret values. Actual environment names and required values must be verified from the active deployment configuration.

## 2. Configuration hierarchy

Configuration may come from environment variables, deployment process configuration, application defaults, database-managed settings, and authorised administrative settings. Precedence must be explicit because process-level values can override portal settings.

## 3. Core categories

### Application

- Environment name.
- Frontend and backend base paths.
- API path.
- Public portal URL.
- Logging and health behaviour.

### PostgreSQL

- Host, port, database, user, and protected credential.
- Connection pool and TLS settings.
- Migration behaviour.

### Microsoft SQL Server

- Server, database, user or approved identity, protected credential, encryption, and timeout settings.

### Authentication and sessions

- Token or session secrets.
- Cookie security.
- Expiry.
- Allowed origins and trusted proxies.

### Email

- Disabled, Testing, or Live governance mode.
- Approved test recipients.
- `EMAIL_REDIRECT_ALL` environment override.
- SMTP settings.
- Microsoft Graph settings.
- Sender identity.

### Microsoft Graph and directory

- Tenant and client identifiers.
- Protected secret or certificate references.
- Approved permissions and scopes.
- Synchronisation schedule.

### File storage

- Attachment and profile-media paths.
- Size and type limits.
- Retention and authorised download configuration.

### Background processing

- Reminder schedule.
- Email-to-Ticket polling.
- Communication scheduling.
- Directory or production synchronisation.

## 4. Secret management

Secrets must not be written to source, reports, frontend bundles, health output, or documentation. Use approved environment or secret-management facilities. Rotation must include dependency validation and rollback planning.

## 5. Email safety

Before live delivery, verify the effective process environment, governance setting, redirect recipients, sender identity, and provider connectivity. A portal setting alone is insufficient evidence if a process-level redirect remains active.

## 6. Environment separation

Development, test, staging, and production should use separate endpoints, credentials, storage, databases, and recipient safeguards where practical. Test data and test email recipients must not be confused with production audiences.

## 7. Configuration changes

A governed change should record current value category, proposed change, environment, actor, reason, validation, backup or rollback, and result. Secret values should be redacted.

## 8. Configuration validation checklist

1. Identify the effective source and precedence.
2. Confirm mandatory values exist.
3. Confirm secrets are protected.
4. Confirm database and storage targets.
5. Confirm portal and API paths.
6. Confirm email mode and redirect state.
7. Confirm Microsoft permissions.
8. Confirm schedules and time zone.
9. Confirm health output is safe.
10. Record environment-specific evidence outside source control where required.
