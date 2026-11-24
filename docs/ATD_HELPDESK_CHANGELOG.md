# ATD Helpdesk Changelog
## 2026-11-23 - Employee catalogue ticket recovery
- Incident and Service Request submissions now default to the governed support-group queue.
- Employees no longer need to select an individual IT agent.
- IT operations can still explicitly propose an assignee.
- Updated Incident guidance to describe support-group routing and agent acceptance.
- Production catalogue-category mapping migration had already been restored.


## 2026-11-23 - Incident catalogue and optional agent recovery
- Restored the live Incident catalogue from the validated local managed Incident catalogue.
- Agent selection is optional for employees. Choosing an agent proposes that agent; leaving it blank uses the support-group queue.
- Service Request and Incident routing continue to use managed catalogue IDs.
- Production rows are backed up before catalogue synchronization.


## 2026-11-23 - Final optional Agent selector recovery
- Preferred IT Agent dropdown is now visible on auto-routed Incident and Service Request forms.
- Blank selection uses the support-group queue; selecting an eligible agent uses proposed-assignee routing.
- Production Incident catalogue remains 25 active unique items with one canonical Other.


## 2026-11-24 - Employee form final repair v2
- Preferred Agent selector retained for auto-routed tickets.
- Employee Impact and Urgency are disabled and calculated from Priority.
- Backend canonicalizes employee Impact and Urgency from governed Priority.


## 2026-11-24 - Ticket submission runtime contract recovery
- Root cause: production tickets.js imported resolveUserWorkspace from financeAccess.js, but production financeAccess.js did not export the function.
- Restore the matching financeAccess.js contract and validate POST /api/tickets route loading before restart.
- Public Apache frontend root is /var/www/helpdesk; validated build source is /var/www/atd-helpdesk/frontend/dist.
- Employee form now includes optional Preferred IT Agent and disabled Priority-calculated Impact/Urgency.
- Incident catalogue is restored to 25 active unique items with one canonical Other.
- Next programme: superadmin-only platform layout, authorized workspace navigation, IT management dashboard first, leadership account matching, reporting registry, then remaining departmental dashboards.
