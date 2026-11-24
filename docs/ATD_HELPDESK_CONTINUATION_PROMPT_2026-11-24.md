# ATD Helpdesk Continuation Prompt - 24 Nov 2026

Continue from this exact state. Do not restart discovery.

## Repository and production
- Local root: C:\Users\jeffrey.motepe\OneDrive - ATD-Alliance\Documents\atd-helpdesk-deployment\atd-helpdesk
- Production server: 10.0.0.12, SSH port 18922, deploy user atddev
- Production source: /var/www/atd-helpdesk
- Public Apache frontend root: /var/www/helpdesk
- Runtime service: pm2-atdadmin.service, runtime owner atdadmin
- API: http://127.0.0.1:3001
- Portal: https://portal.atdalliance.co.za/helpdesk/

## Safety
- Never use git clean, reset --hard, restore ., or checkout .
- Changed-files-only deployment with timestamped backups.
- Never invent user IDs, manager assignments, employee numbers, SharePoint IDs, or workspace grants.
- Match people by active users.id using corporate email or employee number.
- Push validated narrow commits to both GitHub and GitLab without force.
- Update changelog, development tracker, governance/handoff and this continuation prompt after every fix.

## Completed recovery
- Public frontend serving mismatch identified and corrected: Apache serves /var/www/helpdesk.
- Employee form source includes optional Preferred IT Agent.
- Agent blank uses group_queue; selected agent uses propose_assignee.
- Employee Impact and Urgency are disabled and calculated from Priority.
- Backend canonicalizes employee Impact/Urgency from governed Priority.
- Incident catalogue restored to 25 active unique items and one canonical Other.
- catalogue_category_mappings migration applied.
- Ticket dependencies restored: workspaceQueryService, pdmSupportAccess, catalogueLinkService, catalogueCategoryMappingService.
- Current ticket timeout root cause: production financeAccess.js lacks compatible resolveUserWorkspace export expected by tickets.js.

## Current recovery action
Deploy matching backend/src/middleware/financeAccess.js, validate:
- typeof resolveUserWorkspace === function
- require('./src/routes/tickets') succeeds
- pm2-atdadmin.service active
- /api/health healthy
Then test POST /api/tickets for Incident and Service Request with Agent blank and selected.

## Leadership and workspace dashboards
- IT: HOD Nattanon; Manager Neo Kgopa
- HR: HOD Sanjeev (Managing Director); Manager pending
- Commercial: HOD Robert Smith
- PDM: HOD Ryan Capitani
- IE: under PDM; Manager pending
- Maintenance: shared with IE; Manager Isaac Sheunyane
- Process: Manager Ayanda Nongenzi
- Project: Manager Christian Kroll
- Finance: HOD Theraphaa; Managers Suphaporn and Bongani Tshabalala
- SCM: HOD Belinda van Wyk; Manager Marcus Mthombeni
- Plant: HOD Belinda van Wyk; Production Manager Ashwin Govender
- Purchasing: HOD Jiraporn; Manager Wenny
- Quality: HOD Thabitha Joubert; HSE Manager Vishen; Quality Manager Vuyani

## Architecture decision
Keep one modular ATD Helpdesk platform with bounded workspace modules. Centralize authentication, employee directory, ticket core, catalogue, audit, notifications, assignment acceptance, workspace access, and reporting contracts. Split services later only for independent security, uptime, ownership, release cadence, regulatory, or technology boundaries.

## Dashboard programme
1. Superadmin-only platform base layout in sidebar.
2. Below IT options, show only workspaces authorized for the current user.
3. Superadmin tools: Workspace Access, Leadership Mapping, Dashboard Templates, Reporting Builder, Cross-workspace Reports, Platform Health.
4. IT Manager dashboard first: unassigned queue, agent workload, pending acceptance, SLA risk, overdue tickets, major incidents, catalogue demand, assets, recurring issues.
5. IT HOD dashboard: backlog ageing, SLA trend, service health, manager performance, escalations, recurring demand, cross-workspace dependencies.
6. Shared backend reporting registry combines Helpdesk data with governed workspace report providers. No direct frontend cross-database queries.
7. Match leadership accounts and review before any production membership writes.
8. Pending managers remain unassigned.
9. Continue HR, Commercial, Finance, PDM, IE, Maintenance, Process, Project, SCM, Plant/Production, Purchasing, Quality/HSE dashboards using the common shell.

## Authoritative tracking files
- docs/ATD_HELPDESK_DEVELOPMENT_TRACKER.md
- docs/ATD_HELPDESK_CHANGELOG.md
- docs/ATD_HELPDESK_GOVERNANCE_AND_HANDOFF.md
- docs/ATD_HELPDESK_NEW_CONVERSATION_CONTEXT.md
- docs/ATD_HELPDESK_CONTINUATION_PROMPT_2026-11-24.md
Merge duplicate backlog information into the main development tracker. Leave redirect notes in superseded tracker files.
