# ATD Helpdesk Developer Onboarding Guide

## Document control

- **Evidence boundary:** Whole-system repository scan generated 17 September 2026
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Generated marker:** `ATD-DOCS-GROUP-6-SCRIPT-591`


## 1. Purpose

This guide introduces the repository, guarded development method, documentation library, and operational expectations for contributors.

## 2. Start with the documentation

Read `00_DOCUMENTATION_INDEX.md`, the system overview, technical architecture, roles and governance, relevant functional guide, deployment guide, and known limitations before changing source.

## 3. Repository areas

- `frontend/src`: active React frontend source.
- `backend/src`: active Node.js and Express backend source.
- Database migration directories: schema evolution.
- `scripts`: sequential PowerShell collectors, implementations, repairs, validation, and deployment scripts.
- `reports`: UTF-8 evidence reports and temporary backups.
- `docs`: system documentation.

Do not treat release packages or backup directories as active source.

## 4. Script convention

Scripts use the next sequential number and lowercase underscore naming. Repair scripts retain the same convention and clearly include `fix`, for example `592_fix_...ps1`. Run scripts from the repository root and provide the exact command.

Prefer one consolidated report per script. Do not create routine empty stderr reports or unnecessary availability checks.

## 5. Guarded workflow

1. Confirm the current repository state.
2. Collect complete source and dependencies into a UTF-8 TXT report.
3. Review exact source before proposing changes.
4. Create timestamped backups.
5. Refuse unexpected source drift.
6. Apply minimal targeted changes.
7. Validate syntax, build, and relevant behaviour.
8. Roll back automatically on failure where practical.
9. Record one consolidated report.
10. Update existing trackers at the appropriate boundary.

If repeated exact-marker repairs fail, switch to a safer structural patching route rather than continuing a long chain of fragile repairs.

## 6. Functional batches

Implement future feature work in coherent groups of four tightly related functions. Testing is deferred until the milestone implementation is complete, followed by one comprehensive milestone test, one controlled server push, and one consolidated report.

Targeted repair validation remains appropriate for a production defect.

## 7. Safety boundaries

- Do not send live email during development validation.
- Do not write directory values when no change exists.
- Do not remove CMDB functionality or data during rebranding.
- Do not stage unrelated files.
- Do not expose secrets in reports.
- Do not bypass backend authorisation.
- Do not assume a migration is applied because the file exists.

## 8. Local validation

Use the repository's defined frontend build and backend checks. Validate role and permission behaviour, negative paths, migrations, files, scheduled work, email mode, notifications, and durable evidence appropriate to the change.

## 9. Documentation and tracker updates

Update the dedicated development tracker, JSON tracker, and capability register consistently. Preserve filenames, structure, sections, and history. Update the Project README at the milestone boundary.

## 10. Current handoff

- Documentation Groups 1 through 6 are being created through Scripts 586 to 591.
- The immediate engineering priority after documentation is the Notification Centre invalid ticket-action defect.
- Company Communications asynchronous delivery remains in progress.
- The next script after Script 591 is reserved for notification-defect source collection.

## 11. First repair task

The Notification Centre collector should gather complete source for notification creation, database shape, API serialization, frontend display, action dispatch, ticket routes, assignment acceptance, and relevant migrations. The collector must produce one shareable UTF-8 TXT report and perform no source or production changes.

## 12. Definition of done

A change is complete only when scope, source, validation, evidence, tracker state, deployment state, and unresolved risks are accurately recorded. Local implementation must not be described as production deployment.
