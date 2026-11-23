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

