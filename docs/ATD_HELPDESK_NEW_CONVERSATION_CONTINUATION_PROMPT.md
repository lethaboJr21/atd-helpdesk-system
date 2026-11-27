# ATD Helpdesk continuation prompt

Continue the ATD Helpdesk project only. Before changing code, read these canonical live files in order:

1. docs/ATD_HELPDESK_NEW_CONVERSATION_CONTEXT.md
2. docs/ATD_HELPDESK_DEVELOPMENT_TRACKER.md
3. docs/ATD_HELPDESK_MILESTONE_TRACKER.md
4. The latest relevant report under reports/

Current focus is Finance Workspace employee and manager access, followed by SharePoint-backed submission, first review, manager sign-off, Quality rating, provisional on-time Timeliness 50%, direct email links, and employee submission tracking.

Important current rules:
- Finance employees and Finance managers remain global portal users.
- FIN workspace role is agent for Finance employees and manager for active Finance managers.
- Finance staff land in Finance Workspace. Finance employees must not see IT Operations Dashboard or Ticket Workspace.
- Finance managers may switch to IT Helpdesk Employee View and must appear there as ordinary users.
- KPI items and weights are undeclared. Do not apply KPI weighting and do not weaken self-scoring prevention.
- SharePoint is the governed Finance evidence store. Preserve versions and link every file to the Finance task/submission/review.
- jeffreym@atdalliance.co.za remains platform superadmin with all-workspace governance.
- Use four tightly related functions per major batch.
- Every implementation must include its paired preflight, backup, rollback, tests, tracker updates, consolidated UTF-8 report, and current-source anchors.
- Never rerun superseded Scripts 1074-1085.
- Script 1086 is current. Inspect its latest report. If no PASS report exists, continue from its exact blocker.
- Do not use nested Git repositories under Batch backups as the live repository. The live root is C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk.
- Do not create a standalone preflight. Use the existing reports and include any required checks inside the next implementation.
- Preserve canonical tracker filenames, structure and history. Never update historical copies.

Proceed directly with the next safe implementation batch after reading the canonical files and latest report. Explain the four functions and impacts, then implement. Record files, database changes, tests, runtime results, risks, Git scope, commit/deployment status, and exact next work.

Current completed local batch: Script 1099 Finance submission/review/sign-off. Next: lifecycle reminder hardening, role tests, then controlled deployment.


Latest production state: Script 1114 restored Finance identity/membership and Finance access auditing, with production health and protected routes verified.


## 2026-11-27 - Finance membership and manager authority release gate
- Production Finance membership repair completed: 25 active Finance employees now have active FIN workspace membership.
- Finance employees keep global role user; workspace role uses the existing employee-equivalent role agent without granting Helpdesk Operations access.
- Exact Finance managers aligned by authoritative email: bonganit@atdalliance.co.za, suphapornp@atdalliance.co.za, theeraphat@atdalliance.co.za, and jeffreym@atdalliance.co.za.
- Existing Finance manager ATD-Wilawan Suwannasri was preserved.
- Live Script 1125 gate passed: MISSING_FIN_MEMBERSHIP=0, Finance route present, IT Helpdesk jump present, API healthy.
- Rollback snapshots: /tmp/atd1126_finance_membership_backup_20261127_125240.json and /tmp/atd1127_finance_manager_backup_20261127_125718.json.
- Next: implement review authority/timestamps, countdown/absence/reminders, collaboration/multi-KPI, and email/form/mojibake batches.
