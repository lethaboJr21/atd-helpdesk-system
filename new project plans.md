Also add a Welcome email function for the company to be informed of the transition from the freshworks/ freshservice helpdesk, add schedule an email function with options to send to all employee in the company with email and it should also give a link to use to sign in, the email function will be used tomorrow and also  on the ticket reply functions I want the send button to be a drop down to give a function to, while responding to the ticket, it should allow ticket closure with options like Send, Send and Resolve and Send and Close and the email to show pending ticket everyday in the morning should also give a link to directly access those tickets. ​‌


Elements captured from the screenshot
Visibility setting such as Only me, team, workspace, role, or organisation
Editable dashboard name
Configurable widget grid
KPI cards:
Overdue Tickets
Tickets Due Today
Open Tickets
Tickets On Hold
Unassigned Tickets
Tickets I’m Watching
Unresolved tickets by priority
Unresolved tickets by status
New and My Open Tickets
Achievements and performance progression
Monthly leaderboard
Onboarding and offboarding summaries
Journey and activity widgets
Recent Activity
Announcements
Widget three-dot menus
Empty-state visuals when data is unavailable
Per-user customisation and organisation-controlled defaults

This will be added to the deferred 10+ dashboard layouts/templates work rather than interrupting the launch recovery

New deferred task: Freshservice-style Activity page

The attached reference shows a ticket-level Activity tab with a chronological timeline containing:

Ticket creation and initial field values
System and workflow actions
Group and agent assignment changes
Status and priority changes
Planned start/end-date changes
Agent replies and requester replies
Resolution and closure events
Actor name and event timestamp
Relative time labels such as “a few seconds ago”
Clear distinction between System and user activity
Linked values such as support groups
Export capability
Latest activity at the top
Ticket properties remaining visible alongside the timeline



Planned ATD implementation

The ATD version should use the existing ticket_history foundation but expand it into a richer, auditable timeline:

Today
 
10:42 — System
Ticket created through Microsoft Graph email intake.
Reference INC-00162 allocated.
Requester matched successfully.
Assigned to Infrastructure Team.
 
10:44 — Agent
Priority changed from Medium to High.
 
10:47 — System
Escalation approval requested from Workspace Manager.
 
10:51 — Manager
Escalation approved.
Priority changed to Critical.
Ticket promoted to the top of the active queue.


The eventual design should support event types such as:

created
email_intake
assignment_changed
group_changed
status_changed
priority_changed
comment_added
internal_note
reply_sent
requester_replied
attachment_added
escalation_requested
escalation_approved
escalation_rejected
approval_required
planned_dates_changed
sla_changed
resolved
closed
reopened
workflow_executed
notification_sent
email_delivery_failed


Important architectural requirement

The Activity page should not reconstruct important events only from the current ticket state. Important actions must be written to an immutable audit/event record when they happen.

This will later connect directly to:

Escalation requests and approvals
Multi-recipient escalation notifications
Email-to-ticket creation
Assignment and reassignment
Workspace workflows
Terms acceptance audit history
Agent and requester communication
SLA and critical-priority changes

Status: Deferred until after launch stabilisation.


Top-priority next features after deployment readiness
Governed escalation workflow
Multiple recipients
Manager and administrator selection
Custom internal email recipients
Required escalation reason
Priority automatically changed to Critical
Queue elevation
Pending approval state
Configurable approver rules
Self-approval prevention
Approve/reject decisions
Full activity timeline
Department workspace adoption
Department-isolated workspaces
Workspace-specific groups
Workspace-specific notification recipients
Configurable modules
Drag-and-drop ordering
Workspace categories and forms
Controlled cross-workspace collaboration
No IT-only emails sent to Finance unless explicitly shared
Dashboard design system
Improved dark-mode contrast
Semantic colour tokens
Artistic account control
Ten dashboard templates
Ten controlled accent palettes
Organisation, role, and user preference levels
Actionable KPI replacements
Activity page
Freshservice-style chronological timeline
System/user visual distinction
Workflow events
Communications
Escalation and approval events
Export
Immutable audit history


Given the following report, we'll need to create a backup plan just in case we restart the server and the server remains down, we still gain access to the helpdesk still. Please advise how to go about this and I think I'll also need a Online Status monitor for the system which should send a mail when the system is down, and we should also automate a Incident report automatically when the system boots up as to the cause of it's downtime. ATD Helpdesk Incident Analysis

The report provides enough evidence to establish the most probable cause and the recovery timeline.

Executive conclusion

The outage was not caused by Microsoft authentication.

The server rebooted on Thursday, 20 August 2026 at approximately 07:19 SAST. Apache returned 503 Service Unavailable because the ATD Helpdesk Node backend was not restored automatically after that reboot. The PM2 application was manually restored at approximately 11:37 SAST, after which the service came online.

The confirmed control gap is:

pm2-atdadmin.service:
- does not exist
- is not enabled
- is not active

Therefore, PM2 currently has no systemd startup integration to revive ATD Helpdesk automatically after another reboot.

1. Current production health

All current availability checks pass.

Backend listener

The Node process is listening correctly:

127.0.0.1:3001

The process belongs to Node and is reachable locally.

Local API

The direct backend health endpoint returned:

HTTP/1.1 200 OK
status: healthy
database: healthy
emailProvider: microsoft-graph

This proves that Node, PostgreSQL connectivity, and the configured email provider are currently healthy.

Public API

The public health endpoint returned:

HTTP/2 200

through Cloudflare and Apache. This proves the current Cloudflare → Apache → Node proxy chain is functioning.

Microsoft authentication

The public Microsoft authentication endpoint returned:

HTTP/2 302

and redirected to Microsoft’s OAuth authorisation endpoint with the correct production callback path:

/helpdesk/api/auth/microsoft/callback

Therefore, the Microsoft login initiation route is currently working correctly.

2. Confirmed incident timeline
Server shutdown and reboot

The server records show:


Shutdown: 20 August 2026 at approximately 07:19 SAST
New boot: 20 August 2026 at approximately 07:19 SAST
New kernel: 5.15.0-187-generic

The previous boot had been active from 14 August until the shutdown on 20 August.

Backend shutdown

PM2 recorded:

2026-08-20 07:18:48
Stopping app: atd-helpdesk-api
Exited via SIGHUP
Exited peacefully

This aligns directly with the server shutdown one minute later. This was a clean process termination caused by the host shutdown—not an application crash.

Backend restoration

PM2 recorded:
2026-08-20 11:37:01
App atd-helpdesk-api starting
App atd-helpdesk-api online

Therefore, the backend was restored around 11:37 SAST.

Estimated maximum downtime

Using the server reboot and PM2 restoration times:

Incident start: 20 August 2026 at approximately 07:19
Backend restored: 20 August 2026 at approximately 11:37
Maximum duration: approximately 4 hours 18 minutes
Show more lines

This is the maximum infrastructure outage window. Exact user-visible downtime cannot be demonstrated from the available Apache access logs because no historical 503 requests were found in the searched files.

A more precise statement for the incident report is:

The backend was unavailable or not managed by the active PM2 daemon
for up to approximately 4 hours and 18 minutes after the server reboot.
The exact first user impact time is unconfirmed because the relevant
HTTP 503 entries were not retained or were written to another log.
3. Root cause
Primary cause
The Ubuntu server rebooted, terminating the ATD Helpdesk Node process.
PM2 did not automatically restore the saved application after startup.

There is a saved PM2 dump containing the correct process:
Name: atd-helpdesk-api

Script: /var/www/atd-helpdesk/backend/src/server.js

Working directory: /var/www/atd-helpdesk/backend

Autorestart: true


However, a saved dump alone is insufficient if no system startup service launches PM2 and resurrects the dump.

Confirmed configuration gap

The following results conclusively establish the persistence problem:

pm2-atdadmin is not enabled
pm2-atdadmin is inactive
Unit pm2-atdadmin.service could not be found


This is the most important finding from the investigation.

User-visible result

Apache remained available on HTTPS, but the reverse-proxy target on 127.0.0.1:3001 was unavailable. Consequently, visiting:

/helpdesk/api/auth/microsoft


produced an Apache-generated 503 Service Unavailable page.

Microsoft authentication appeared broken because Microsoft login depends on that backend route, but Microsoft Entra was not the failing component.

Later
a person who has never signed in, should appear under Inactive/ Deactivated and only show under Active after initially sign in
Request temporary loan functionality
Register current device option
Laptop performance checkup after 2 months and should not allow to perform checkup until 2 months has elapsed


For workspace access granting , it should permit the admin to give read, write and modify privileges to the assignee.

We need to update the readME file on Github and Gitlab


Now I want you to turn this dashboard into something smart, but also remember that we have to give nice landing page for our Employee Access as well so maybe if you could prepare the coolest templates and react components that are very cool to add on backgrounds, a website or our helpdesk, but also I want us to think of multiple options of features like Templates, visuals and Layouts, at least can we also have a situation on all pages that when you click something and it pops up a window which may allow you to modify or make changes, while at it, you should only be locked from clicking or editing anything else outside of that window.
 For my sidebar, I want it to float back when we are hovering far from it but should have a cool mostly used and latest open side bar function and all the other pages should be standardised to have Back to Dashboard if it is one click away from dashboard so now what
 But for now, I

Copilot said:

Reasoning completed in 1 step
Jeffrey, the current dashboard already has a strong operational foundation: a dark navigation rail, clear KPI cards, ticket volume chart, service mix chart, priority queue and ticket preview. The next step should not be adding random visual effects—it should be creating a consistent, intelligent design system that works across the Operations Dashboard, Employee Access and every administration page.

What stands out in the current dashboard
From the screenshot:

The left sidebar takes substantial permanent width.
The top action area contains Search, Alerts, Refresh, Logout, Manage Users, Production and New Ticket.
The four primary cards show:
125 open tickets
SLA compliance: N/A
1 critical/at-risk ticket
7-day average resolution
Ticket Volume occupies a large area despite currently displaying very little activity.
Service Mix shows 107 IT, 11 Infrastructure Team and 9 ERP Team tickets.
The primary queue and ticket preview are below the fold.
Administration, employee preview and external operational applications are mixed in one long sidebar.
“Collapse menu” consumes space while not yet providing a compact productivity experience.
The layout is clean, but it can become much smarter, denser and more personalised.

Proposed design direction
I recommend a design language called:

ATD Command Centre
The design should combine:

Microsoft Fluent-style clarity
Modern glass panels used selectively
Strong ATD blue
Dark navy navigation
Soft neutral page backgrounds
Colour used to communicate state—not merely decorate
Consistent cards, drawers, dialogs and forms
Personalised workspaces based on role
Accessible animations and keyboard support
The system should feel modern without becoming distracting.

1. Smart Operations Dashboard
Instead of one fixed dashboard for everyone, the dashboard should respond to the signed-in user’s role, workload and recent activity.

Smart welcome header
The top area could contain:




Good morning, Jeffrey
3 tickets need your attention • 1 SLA risk • 2 pending approvals
Actions would be contextual:

Create ticket
Resume active ticket
Review critical tickets
Approve users
Open notification centre
Personalised dashboard cards
Users should be able to:

Reorder cards
Hide cards
Resize cards
Pin cards
Restore the default layout
Save different dashboard views
Select a role-specific template
Suggested templates:

Operations Overview
For administrators and service managers:

Open tickets
SLA compliance
Critical tickets
Average resolution
Group workload
Ticket trends
Support coverage
Escalations
Agent Workspace
For support agents:

My assigned tickets
Tickets awaiting my response
Overdue work
Recently opened
Unassigned group tickets
My active ticket
Today’s tasks
Quick knowledge search
Executive Summary
For management:

Total demand
Resolution trend
SLA performance
Top service interruptions
Department demand
User satisfaction
Recurring issues
Month-on-month comparisons
Administration Control Centre
For authorised administrators:

Pending account approvals
Deactivated accounts
Email service health
Failed notification deliveries
System setting changes
Audit activity
Module availability
Security warnings
Make KPI cards interactive
Each summary card should open a correctly filtered view.

For example:

Open Tickets → ticket list filtered to active statuses
Critical / At Risk → critical or SLA-risk tickets
Average Resolution → resolution analytics
SLA Compliance → SLA performance page
Service Mix segment → tickets for the selected group
A secondary action could open a small preview panel without leaving the dashboard.

2. Standard modal and drawer system
Your idea of opening a controlled window is correct. The technical pattern is called a modal dialog.

When a modal is open:

The background receives a dark translucent overlay.
Background controls cannot be clicked.
Background scrolling is locked.
Keyboard focus remains inside the modal.
Escape closes the modal when it is safe.
Closing restores focus to the button that opened it.
Unsaved changes trigger a warning.
Destructive actions require explicit confirmation.
The modal remains usable on smaller screens.
Use three controlled window types
A. Modal dialog
Best for focused, short actions:

Edit user
Change role
Assign agent
Add category
Update ticket priority
Confirm archive
Configure notification preference
Suggested widths:

Small: confirmation and simple input
Medium: normal editing
Large: multi-section configuration
Full-screen mobile: all dialogs on narrow devices
B. Right-side drawer
Best for preview and context:

Ticket preview
User profile preview
Notification centre
Asset preview
Audit record details
Quick edit
Recent activity
The drawer allows users to inspect something while retaining awareness of the current page.

C. Full workspace dialog
Best for complicated operations:

Create ticket
Advanced ticket editing
User access and entitlements
Project setup
Asset registration
Administration templates
This can use a stepped workflow while still locking the background.

Important design rule
Not every click should open a modal.

Use:

Normal navigation for complete workspaces
Drawers for preview and quick context
Modals for focused changes
Menus for short action lists
Tooltips for explanations
Opening everything in a modal would create deeply nested windows and make browser navigation confusing.

Global component structure
A reusable system could eventually look like:




OverlayProvider
├── Modal
│   ├── ModalHeader
│   ├── ModalBody
│   ├── ModalFooter
│   └── UnsavedChangesGuard
├── Drawer
├── ConfirmDialog
├── CommandPalette
├── ToastRegion
└── LoadingOverlay
This should replace page-specific popup implementations so every dialog behaves consistently.

3. Intelligent floating sidebar
Your sidebar idea can become a major productivity feature.

Three sidebar states
Expanded
Icons and labels
Module group headings
Recent pages
Favourites
Current workspace
Assigned-ticket indicator
Compact
Icons only
Tooltips on hover
Small unread badges
Active-page indicator
Favourite icons visible
Peek / floating mode
When collapsed:

Moving the pointer near the left edge reveals a thin activation rail.
Hovering over the rail slides the sidebar over the page.
Moving away closes the sidebar after a short delay.
Clicking the pin button keeps the sidebar open.
The main content does not jump when the sidebar floats.
Keyboard users can open it with a shortcut.
This is better than expanding simply whenever the pointer travels anywhere on the left side because accidental opening would become irritating.

Add productivity sections
Frequently Used
Calculated from the signed-in user’s opening frequency:

Ticket Workspace
Create Ticket
User Administration
Assets
Admin Settings
Recently Opened
Example:




INC-24081 — MES terminal sync
User: Employee record
Admin Settings — Email
Asset: LAP-00452
Favourites
Users manually pin:

Pages
Ticket filters
Reports
Actions
Individual projects
Knowledge articles
My Work
Active assigned ticket
Open tasks
SLA risks
Pending approvals
Draft ticket
Suggested sidebar structure



ATD Alliance Helpdesk

MY WORK
• Dashboard
• Assigned Tickets
• Recent
• Favourites

SERVICE MANAGEMENT
• Ticket Workspace
• Assets / CMDB
• Knowledge

OPERATIONS
• Plant Operations
• AMS Alerts
• Production

ADMINISTRATION
• Users
• Groups and Agents
• Settings
• Audit Log

EMPLOYEE EXPERIENCE
• Employee Access Preview
• Switch to Employee View

Show more lines
Collapsible module groups will make this substantially easier to scan.

4. Standard page navigation
You are right that every page one level below the dashboard should have a consistent way back.

Recommended hierarchy
Every internal page should have:




Dashboard / Administration / Users / Employee Details
Each breadcrumb segment should be clickable.

For a direct dashboard child page:




← Back to Dashboard
For deeper pages:




← Back to Users
The breadcrumb still provides a route to Dashboard.

Standard page header
Every page should follow one structure:




Breadcrumbs
Page title                          Primary action
Short supporting description       Secondary actions
Tabs or filters
Example:




Dashboard / Administration / Users

User Administration                 + Add User
Manage access, roles and accounts.  Export | Sync M365
This removes the need to relearn each page.

5. Employee Access landing page
The Employee Access experience should not look like a simplified administrator dashboard. It should feel like a friendly service portal.

Employee landing option A — Service Hub
A welcoming employee-first layout:




How can IT help today?
[ Search services, solutions or existing tickets ]

Common Requests
[ Password ] [ Microsoft 365 ] [ Hardware ] [ Network ]
[ Software ] [ Access ] [ Security ] [ Other ]

My Requests
• 2 open
• 1 awaiting my response
• 8 resolved

Recommended Articles
Service Status
My Devices
Contact Support

Show less
Best for ease of use and general employee adoption.

Employee landing option B — Conversational Assistant
The centrepiece is a smart request prompt:




Describe what you need help with...
The portal then suggests:

A relevant knowledge article
A suitable service category
Required information
A ticket form
An existing outage or known issue
This should assist users without pretending every issue can be solved automatically.

Employee landing option C — App Launcher
A visual tile-based page:

Submit a Request
Report a Problem
My Tickets
My Devices
Microsoft 365
Access Requests
Knowledge Base
Service Status
Contact IT
Best for environments where employees return to a few predictable functions.

Employee landing option D — Hybrid
This is my recommendation.

It combines:

Welcome/search hero
Common-request tiles
My active requests
Service status
Knowledge suggestions
Assigned devices
Announcements
Contact and remote-support options
6. Visual and background templates
We can prepare several reusable themes without changing the portal’s identity.

Template 1 — Aurora Command
For administrator and sign-in backgrounds:

Deep navy base
Blue and violet aurora gradients
Fine grid texture
Soft illuminated circles
Slow ambient movement
White operational panels
Use animation sparingly and respect reduced-motion preferences.

Template 2 — Connected Systems
Abstract network of connected service nodes
Subtle lines representing employees, tickets, assets and teams
ATD blue and cyan
Suitable for Employee Access and system overview pages
Template 3 — Digital Factory
Abstract production environment
Soft geometric machinery silhouettes
Dashboard-style data lights
Appropriate for Plant Operations and Production
Avoid detailed imagery that competes with text
Template 4 — Clean Fluent
Light neutral background
Soft blue radial glow
Minimal geometry
Crisp panels and shadows
Best for daily service-management work
Template 5 — Department Identity
A shared layout with visual accents per module:

Helpdesk: blue
Infrastructure: violet
Assets: teal
Security: red/amber
Projects: indigo
Knowledge: cyan
Administration: slate
Colours should indicate module context while retaining one overall system.

7. Reusable React component library
Rather than designing every page separately, we should build a reusable UI kit.

Navigation
AppShell
SmartSidebar
SidebarSection
SidebarRecentItems
SidebarFavourites
Breadcrumbs
PageHeader
CommandPalette
Overlays
Modal
Drawer
ConfirmDialog
FormDialog
UnsavedChangesDialog
LoadingOverlay
Dashboard
DashboardGrid
MetricCard
TrendCard
SmartInsightCard
ChartPanel
QuickActionCard
ActivityTimeline
PriorityQueue
ServiceHealthCard
Employee Access
EmployeeHero
ServiceSearch
RequestCategoryGrid
MyRequestSummary
KnowledgeSuggestion
ServiceStatusBanner
MyDeviceCard
SupportContactCard
Forms and feedback
FormField
SearchableSelect
Dropzone
InlineValidation
Toast
AlertBanner
EmptyState
SkeletonLoader
ErrorState
8. “Smart” features worth adding
Command palette
A keyboard shortcut such as Ctrl+K opens:





Search tickets, users, assets, pages and actions
Examples:

“Create ticket”
“Open INC-24081”
“Find employee”
“Go to email settings”
“Show critical tickets”
“Switch to employee view”
Context-aware quick actions
The portal determines appropriate actions from the current page.

On User Management:

Add user
Sync Microsoft 365
Approve pending users
Export filtered users
On Ticket Workspace:

New ticket
Assign to me
Open critical queue
View unassigned
Smart insights
The dashboard can surface explainable observations:

“Critical ticket volume increased this week.”
“Infrastructure Team has the highest unassigned workload.”
“Five tickets have had no activity for more than two days.”
“Account-related requests are the fastest-growing category.”
Each insight should link to the underlying filtered data.

Saved views
Users could save combinations of:

Filters
Sort order
Visible columns
Dashboard layout
Date range
Group or workspace
9. Recommended implementation batches
Batch UX-1 — Foundation
Build first:

Design tokens
Standard page shell
Standard page header
Breadcrumbs
Modal and focus-lock system
Drawer system
Toast/alert system
Unsaved-change protection
This gives every future feature a consistent base.

Batch UX-2 — Smart Sidebar
Expanded, compact and floating states
Pin/unpin
Edge-hover activation
Recently opened items
Favourites
Frequently used items
Collapsible module groups
Active-ticket reference
Persist preferences per user
Batch UX-3 — Smart Dashboard
Role-based layouts
Interactive metric cards
Customisable dashboard grid
KPI drill-down drawers
Priority queue improvements
Smart insights
Saved dashboard templates
Better chart empty states and scaling
Batch UX-4 — Employee Access
Employee landing hero
Service search
Common-request cards
My Requests
Knowledge suggestions
My Devices
Service status
Employee notification centre
Mobile layout
Batch UX-5 — Page Standardisation
Back navigation
Breadcrumbs everywhere
Standard forms
Standard data tables
Standard loading and empty states
Standard actions menus
Responsive behaviour
Accessibility audit
What we should build now
The best next step is Batch UX-1, specifically:

Global modal, drawer, backdrop and focus-lock system, followed by the standard PageHeader and Breadcrumbs components.

That immediately delivers your requirement that an editing window:

opens above the page,
blocks interaction outside it,
locks background scrolling,
captures keyboard focus,
warns about unsaved changes,
and behaves consistently across User Management, Settings, Tickets, Assets and future modules.
After that, we should implement the floating Smart Sidebar and then redesign the dashboard using the new component system.The Employee Access landing page should be prepared in parallel as the recommended Hybrid Service Hub, but connected to real ticket categories, service status, current requests and knowledge articles—not only used as a visual mock-up.

The landing-page options should become a configurable experience system, not four separate hard-coded pages.

Administrators should be able to define the organisation default and permitted options, while employees can choose and customise their preferred landing experience within those boundaries.

Target configuration model

We should support three levels of settings:

1. Organisation-level defaults

Managed through Admin Settings → Employee Experience.

Administrators configure:

Default employee landing template
Templates employees are allowed to select
Default widgets for each template
Required widgets that employees cannot remove
Optional widgets employees may add or hide
Default widget order
Branding and visual theme
Background style
Announcements
Quick-request categories
Knowledge article suggestions
Employee personalisation permissions
Whether employee preferences follow the user across devices
Reset everyone to the organisation default
Preview before publishing
2. Role, department or group defaults

These provide a more relevant starting point without creating separate applications.

Examples:

Finance employees see access requests, Microsoft 365 and ERP support.
Plant employees see production systems, hardware and operational alerts.
New employees see onboarding, access, equipment and common articles.
Managers see team-related requests and approval items.
IT employees see operational shortcuts.
Remote employees see VPN, device health and remote-support options.

Possible targeting:

Role
Department
Office or location
Microsoft 365 group
Employee group
Employment type
Specific users
3. Personal employee preferences

Employees manage these through:
Employee Access → My Preferences
Show more lines

Employees could select:

Preferred landing template
Light, dark or system theme
Background style
Compact or comfortable spacing
Widget arrangement
Favourite services
Quick actions
Visible optional widgets
Default ticket view
Notification preferences
Reduced-motion preference
Sidebar state
Recently opened visibility
Frequently used visibility
Default landing route

Employees should only customise items allowed by administration policy.

Landing templates to prepare

All four proposed landing experiences should be available as configurable templates.

Template A — Service Hub

Designed for employees who want clear service categories.

Core areas:

Welcome header
Service search
Common requests
My requests
Recommended articles
Service status
My devices
Contact IT
Template B — Guided Assistant

Designed for employees who may not know which service or category to select.

Core areas:

“Describe what you need” prompt
Suggested request category
Suggested knowledge articles
Known-issue detection
Guided questions
Ticket form launcher
Existing related requests

The assistant should provide suggestions, but employees must still be able to browse services manually.

Template C — Application Launcher

Designed for employees who repeatedly use a small number of services.

Core tiles:

Report a Problem
Request a Service
My Tickets
My Devices
Microsoft 365
Access Requests
Knowledge Base
Service Status
Remote Support
Contact IT

Employees can reorder permitted tiles and choose favourites.

Template D — Hybrid Employee Hub

This should be the recommended ATD default.

It combines:

Search and guided help
Common-request cards
Active requests
Service status
Suggested knowledge
Assigned devices
Announcements
Favourite services
Support contacts
Additional future template — Minimal

A highly focused accessibility-friendly option:

Search
Create request
My open requests
Service status
Contact IT

This is useful for employees who prefer reduced visual complexity.

Settings precedence

We need a predictable rule for resolving overlapping settings.

Recommended precedence:
System-enforced policy
↓
Targeted role/department default
↓
Organisation default
↓
Employee preference
↓
Built-in application fallback
Show more lines

However, employee preferences must override defaults only for settings marked as customisable.

For example:


Organisation requires Service Status widget
→ Employee cannot hide it
 
Organisation allows theme selection
→ Employee selects dark theme
 
Department defaults Microsoft 365 as first service
→ Employee can reorder it if personal ordering is permitted
Show more lines

Every setting should therefore have both:

A value
A personalisation policy

Example policy values:
locked
editable
hidden
required
optional

What should be prepared now
Batch EX-0 — Requirements and configuration contract

Before frontend redesign begins, prepare a formal configuration model.

Template definitions

Each template needs:

Unique key
Display name
Description
Preview image
Supported widgets
Required widgets
Default widget layout
Supported themes
Mobile layout
Status: draft, published or retired
Version number

Example template identifiers:
service_hub
guided_assistant
application_launcher
hybrid_hub
minimal
Show more lines
Widget definitions

Every landing-page section becomes a reusable widget.

Initial widgets:

employee_welcome
service_search
guided_support
common_requests
my_requests
request_summary
service_status
knowledge_suggestions
my_devices
announcements
favourite_services
recently_used
support_contacts
remote_support
quick_actions
pending_employee_actions
Show more lines

Each widget should define:

Whether it can be hidden
Whether it can be reordered
Available sizes
Required permissions
Data source
Refresh interval
Empty state
Error state
Mobile behaviour
Personal settings
Database preparation

The existing system_settings and user_feature_entitlements tables provide part of the foundation, but employee experience preferences should have dedicated storage.

New tables to prepare
employee_experience_settings

Stores the organisation’s published configuration.

Suggested information:

Default template
Allowed templates
Personalisation enabled
Default theme
Allowed themes
Default background
Widget policies
Branding configuration
Published version
Updated by
Updated at
employee_landing_preferences

Stores each employee’s choices.

Suggested information:

User ID
Selected template
Theme
Background
Density
Sidebar mode
Default landing route
Widget layout
Favourite services
Hidden optional widgets
Accessibility settings
Preference version
Updated at
employee_experience_assignments

Stores targeted configurations.

Suggested targeting:

Department
Role
Group
Location
Specific user

It should include:

Target type
Target identifier
Template
Configuration override
Priority
Active status
Effective dates
employee_experience_templates

This is useful if administrators will eventually create and publish customised templates rather than only selecting built-in templates.

Suggested information:

Template key
Name
Description
Base template
Configuration
Preview asset
Version
Draft/published status
Created by
Updated by
Publication date
user_navigation_preferences

Stores navigation behaviour separately:

Sidebar mode
Sidebar pinned state
Favourite pages
Frequently used visibility
Recently opened visibility
Collapsed sections
Dashboard shortcut preferences
user_recent_items

Stores recent records safely:

User ID
Item type
Item identifier
Display label
Route
Last opened date
Open count

Sensitive content should not be copied into this table unnecessarily.

Settings API preparation

Prepare protected endpoints in logical groups.

Employee-facing endpoints
GET /api/employee-experience
GET /api/employee-experience/preferences
PUT /api/employee-experience/preferences
POST /api/employee-experience/preferences/reset
GET /api/employee-experience/templates
GET /api/employee-experience/widgets
Show more lines

The main experience endpoint should return the resolved configuration, not force the frontend to combine multiple policy levels.

Example response concept:

JSON
{
"template": "hybrid_hub",
"theme": "system",
"background": "aurora",
"personalisation": {
"template": true,
"theme": true,
"background": true,
"widgetOrder": true,
"widgetVisibility": true
},
"widgets": []
}
Show more lines
Administration endpoints
GET /api/admin/employee-experience
PUT /api/admin/employee-experience
GET /api/admin/employee-experience/templates
POST /api/admin/employee-experience/templates
PUT /api/admin/employee-experience/templates/:id
POST /api/admin/employee-experience/templates/:id/publish
POST /api/admin/employee-experience/templates/:id/duplicate
POST /api/admin/employee-experience/preview
GET /api/admin/employee-experience/assignments
POST /api/admin/employee-experience/assignments
PUT /api/admin/employee-experience/assignments/:id
DELETE /api/admin/employee-experience/assignments/:id
Show more lines

All administrative modifications must create an entry in:

administration_audit_log
Show more lines
Administration interface to prepare

Add a new area:

Admin Settings
└── Employee Experience
├── General
├── Landing Templates
├── Widgets
├── Branding and Backgrounds
├── Audience Assignments
├── Personalisation Policy
├── Preview
└── Change History
Show more lines
General
Enable Employee Access
Default landing template
Default theme
Default background
Default density
Default landing route
Landing Templates

Cards showing:

Template preview
Template name
Active or unavailable state
Number of assigned employees
Edit
Duplicate
Preview
Publish
Retire
Widget controls

Administrators decide which widgets are:

Required
Optional
Disabled
Employee-configurable
Restricted by role
Personalisation policy

Examples:

Allow employees to change template Yes
Allow employees to move widgets Yes
Allow employees to hide optional widgets Yes
Allow custom backgrounds No
Allow dark theme Yes
Allow landing route selection Yes
Show more lines
Preview mode

Administrators should preview the experience as:

A general employee
A selected department
A selected role
A specific employee
Desktop
Tablet
Mobile
Light mode
Dark mode

Preview must not modify the administrator’s own preferences.

Employee preference interface

Add:

Employee Access
└── My Preferences
├── Appearance
├── Landing Page
├── Widgets
├── Navigation
├── Notifications
└── Accessibility
Show more lines
Appearance
Theme
Background
Colour intensity
Comfortable or compact density
Reduced motion
Landing Page
Template selection
Template preview
Default opening route
Reset to organisation default
Widget editor

Employees could enter a controlled “customise” mode:

Drag widgets into position
Resize supported widgets
Hide optional widgets
Add available widgets
Restore default layout
Save
Cancel

Unsaved changes should remain local until the employee clicks Save Layout.

Navigation
Sidebar expanded, compact or floating
Pin sidebar
Show favourites
Show recent items
Show frequently used
Manage favourite shortcuts
Global modal and focus-lock preparation

Your controlled popup requirement should be implemented before building all these preference screens.

Required behaviour

When a dialog opens:

A backdrop covers the rest of the application.
Background pointer interaction is disabled.
Background scrolling is locked.
Keyboard focus enters the dialog.
Tab and Shift+Tab remain within the dialog.
The rest of the page is hidden appropriately from assistive technology.
Escape closes only when allowed.
Unsaved edits trigger a warning.
Focus returns to the original trigger after closing.
Nested destructive confirmation is carefully controlled.
Mobile devices receive a full-screen dialog when required.
Reusable overlay components

Prepare:

Modal
FormModal
ConfirmDialog
SideDrawer
FullScreenDialog
UnsavedChangesGuard
LoadingOverlay
ModalFooter
Show more lines

The preference editor can use a full-screen dialog, while simple settings use standard modals.

Smart sidebar preparation

The sidebar needs its own preference and activity services.

Sidebar states
expanded
compact
floating
Show more lines
Floating behaviour
A small edge trigger remains visible.
Hovering over the trigger opens the sidebar.
Moving away starts a short closing delay.
Hovering back cancels the close.
Clicking Pin converts it to expanded mode.
Opening a modal temporarily closes the floating sidebar.
Touch devices use a menu button rather than hover.
The main page does not shift when the floating sidebar appears.
Sidebar data

Prepare:

Favourites
Recently opened pages
Recently opened records
Frequently used pages
Current assigned ticket
Unread notifications
Permission-aware module groups

Frequently used items should be determined from usage counts, but employees must be able to disable that feature.

Background and visual system preparation

Avoid storing arbitrary CSS entered by employees. Use controlled visual tokens.

Background choices

Initial options:


clean_light
clean_dark
aurora_blue
connected_systems
digital_factory
soft_gradient
minimal
Show more lines

Settings can include:

Background key
Intensity
Motion enabled
Contrast mode

Administrators determine which backgrounds are allowed.

Design tokens

Prepare central tokens for:

Primary and secondary colours
Surface colours
Text colours
Borders
Shadows
Radius
Spacing
Typography
Overlay opacity
Sidebar widths
Animation duration
Status colours
Focus rings

Both Operations and Employee Access should use the same design tokens while allowing different layouts.

Data and security rules
Never trust preference JSON directly

The backend must validate:

Template is allowed
Widgets are recognised
User has permission for every widget
Size is supported
Layout coordinates are valid
Restricted widgets remain required
Background is permitted
Routes are safe internal routes
Permission-aware widgets

Hiding a navigation item is not security.

For example:

An employee must not access administration endpoints by entering the URL.
An agent must not receive executive data merely because a widget identifier was manipulated.
Users should only see permitted ticket and asset information.
Preference size limits

Set limits for:

Number of favourites
Number of recent items
Number of widgets
Layout JSON size
Announcement content
Custom template count
Rollout plan
Batch 1 — Experience foundation

Prepare now:

Experience and preference database migration
Settings resolution service
Validation schemas
Employee preference API
Administration experience API
Audit logging
Design tokens
Modal and drawer foundation
Standard page headers and breadcrumbs
Batch 2 — Landing templates

Implement:

Service Hub
Guided Assistant
Application Launcher
Hybrid Employee Hub
Minimal template
Shared widget library
Desktop and mobile layouts
Template preview system
Batch 3 — Preference Centre

Implement:

Appearance settings
Template selector
Widget customisation
Navigation preferences
Accessibility preferences
Reset to default
Save/cancel workflow
Unsaved-change protection
Batch 4 — Administration Experience Manager

Implement:

General default settings
Allowed templates
Required/optional widgets
Personalisation policy
Department and role assignments
Preview as user
Draft and publish workflow
Version history and rollback
Batch 5 — Smart Sidebar

Implement:

Expanded/compact/floating modes
Edge-hover behaviour
Pin/unpin
Recent items
Frequently used
Favourites
Active-ticket reference
User preference persistence
Batch 6 — Dashboard intelligence

Implement:

Role-based dashboards
Custom card layouts
Saved dashboard views
Smart insights
Clickable KPI drill-down
Preview drawers
Better chart states
Personal dashboard templates
Tests to prepare
Preference resolution tests

Validate combinations such as:

Organisation default + no employee preference
Department default + employee preference
Locked organisation setting + attempted override
Retired template + existing employee preference
Removed widget + saved employee layout
Role change + previously permitted widget
Show more lines
Modal tests
Background is not clickable.
Background does not scroll.
Focus stays inside the dialog.
Escape behaviour is correct.
Unsaved changes are protected.
Focus returns to the trigger.
Mobile layout remains usable.
Template tests
Every template loads.
Every widget has loading, empty and error states.
Layout works on desktop, tablet and mobile.
Templates retain permissions.
Reset restores the resolved default.
Retired templates safely fall back.
Accessibility tests
Keyboard-only navigation
Visible focus indicators
Screen-reader labels
Sufficient colour contrast
Reduced-motion support
Correct dialog semantics
Logical heading hierarchy
Status not communicated by colour alone
Immediate preparation checklist

Before coding the visible landing pages, prepare these deliverables:

 Database migration for experience settings and user preferences
 Template and widget configuration schema
 Settings precedence rules
 Personalisation policy model
 Backend settings resolution service
 Employee preference endpoints
 Administration configuration endpoints
 Audit-log integration
 Global modal and drawer components
 Focus and scroll locking
 Standard page header and breadcrumbs
 Design tokens and theme provider
 Template registry
 Widget registry
 Default Hybrid Employee Hub configuration
 Preference reset and fallback behaviour
 Desktop/mobile preview mode
 Permission and validation tests

## Milestone update 2026-09-07
- Added controlled avatar crop, fit, fill, zoom and modal isolation.
- Added sticky Ticket Monitor headings.
- Added Ticket Workspace List/Kanban, Select mode and current-page selection.
- Added theme-aware semantic priority badges.
- Governed bulk mutations remain deferred until dedicated ticket bulk endpoints exist.

<!-- ATD-MILESTONE-SCRIPT-345-SLA-KANBAN-OVERDUE -->
## Validated SLA, Kanban, and Overdue milestone

- Ticket Workspace uses theme-aware Critical, High, Medium, and Low priority bubbles.
- Kanban cards display assignee, Unassigned fallback, Ticket Due, and an SLA countdown gauge.
- SLA gauge thresholds are green above 50% remaining, orange at or below 50%, red at or below 25%, and overdue at zero.
- Governed Kanban drag-and-drop requires confirmation, uses the protected status endpoint, records activity, and exposes the existing Undo notification.
- Direct drag to Resolved or Closed is blocked so governed completion requirements are not bypassed.
- Kanban column names and ticket counts remain sticky while cards scroll.
- Dashboard SLA Compliance has been replaced by authoritative Overdue Tickets using unresolved tickets with due_at at or before the current time.
- Backend stats syntax and the frontend production build passed on 7 September 2026.
- Deployment remains separate from validation. Reports, backups, release artifacts, and duplicate source files must not be committed.

### Deferred after this deployment

- Governed multi-ticket mutation endpoints and Dashboard Priority queue bulk operations.
- Requestor Department and expanded reusable filters.
- Company and Department announcement feeds, discussions, comments, checklists, email delivery, unread alerts, and persistent notification actions.
- Microsoft Directory no-change journal and Monday 08:00 weekly report attachment.
- Cartoon avatar library and announcement identity cards.
