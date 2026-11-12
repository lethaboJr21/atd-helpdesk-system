# ATD Helpdesk System Overview

## Document control

- **Evidence boundary:** Repository scan generated 17 September 2026
- **Source branch:** `feature/launch-communications-queue-compatibility`
- **Source commit:** `c6457db04b3de07f411cd62d894a8119f3c8e005`
- **Status:** Foundational system reference
- **Generated marker:** `ATD-DOCS-GROUP-1-SCRIPT-586`

## 1. Purpose

ATD Helpdesk is an internal service-management portal that brings employee support, ticket operations, access governance, communications, administration, reporting, and selected enterprise integrations into one controlled application.

The system is designed for several audiences:

- Employees who submit and follow requests.
- Helpdesk agents who triage, assign, investigate, communicate, and resolve work.
- Managers who monitor queues, team performance, approvals, and operational risk.
- Administrators who manage users, roles, permissions, configuration, communications, and governance.
- Superadministrators who perform high-impact governed actions.
- Developers and operational support staff who maintain, validate, deploy, and troubleshoot the platform.

## 2. Core product areas

### 2.1 Authentication and account lifecycle

The application contains sign-in, registration, approval, terms acceptance, onboarding, profile, avatar, role, and permission foundations. Access to protected functions must be enforced by the backend and reflected by the frontend.

### 2.2 Ticket management

The ticketing area supports the operational lifecycle from request creation through triage, assignment, work, communication, resolution, closure, reopening, archive, restore, and governed deletion. Supporting functions include attachments, activity history, comments, participants, bulk operations, SLA information, and queue views.

### 2.3 Employee experience

Employees use the portal to create and review requests, follow updates, respond to support, view announcements, access knowledge and catalogue functions, manage profile settings, and use authorised dashboard experiences.

### 2.4 Agent and manager operations

Operational users work with queues, ticket details, assignment acceptance, support groups, priorities, statuses, notifications, SLA information, activity history, dashboards, and reporting foundations.

### 2.5 Administration and governance

Administrative functions include user administration, access requests, roles and permissions, temporary entitlements, support groups, email governance, communications, directory integration, archive controls, health evidence, and audit information.

### 2.6 Company Communications

Company Communications provides campaign authoring, audience definition, approval, scheduling, attachments, announcements, conversations, delivery history, and email-governance integration. The asynchronous delivery-reliability batch remains in progress and must not be documented as completed until Script 582 or its guarded replacement is validated.

### 2.7 Dashboards, themes, and layouts

The portal contains dashboard templates, widgets, pinned actions, employee and operational dashboard experiences, appearance preferences, and layout foundations.

Glassmorphism is a **portal theme and layout styling option only**. It must be managed with themes, Light/Dark mode, accessibility safeguards, and named custom layouts. Glassmorphism does not apply to email templates.

### 2.8 Knowledge, catalogue, assets, and workspaces

The repository contains foundations for knowledge content, request catalogue and guided routing, asset or configuration records, department workspaces, and related administrative experiences. Documentation must use the current product name for asset/configuration functionality once the approved replacement for “CMDB” is supplied. Functionality and data must not be removed during rebranding.

### 2.9 Notifications, activity, and audit

The platform records operational events and exposes notification and activity experiences. Action-required items must remain actionable after being marked read. Ticket activity should identify participant, activity, and timestamp.

### 2.10 Integrations

The system contains integration foundations for Microsoft Graph, SMTP email, Microsoft directory synchronisation, inbound email-to-ticket, Freshservice historical data, and production reporting or synchronisation services.

## 3. Capability status language

All documentation in this repository must use one of these states:

- **Implemented and deployed**
- **Implemented and validated locally**
- **Implemented locally, validation pending**
- **Partially implemented**
- **Foundation present**
- **Planned**
- **Deferred**
- **Legacy or retained for compatibility**
- **Unable to verify**

Source presence alone does not prove production availability. Deployment evidence and production validation are required before a capability is marked implemented and deployed.

## 4. Current evidence notes

The documentation scan was collected from a working tree that contained existing local modifications. These local files must not automatically be described as deployed. Historic release packages, reports, backups, and archived source are secondary evidence and do not override current `frontend/src`, `backend/src`, current migrations, or verified production evidence.

## 5. Product principles

- Preserve working functionality and data.
- Apply backend authorisation to every governed action.
- Use minimal, reversible changes with backups and rollback.
- Record significant activity with actor and timestamps.
- Keep test email recipients isolated from live audiences.
- Make high-impact actions explicit and governed.
- Provide accessible, responsive interfaces.
- Keep roadmap items separate from completed functionality.
- Validate a completed milestone comprehensively before deployment.

## 6. Related documents

- [Functional Capability Guide](02_FUNCTIONAL_CAPABILITY_GUIDE.md)
- [Technical Architecture](03_TECHNICAL_ARCHITECTURE.md)
- [Roles, Access and Governance](04_ROLES_ACCESS_AND_GOVERNANCE.md)
