param([string]$RepositoryRoot = "")

$ErrorActionPreference = "Stop"

function Resolve-RepositoryRoot {
  param([string]$RequestedRoot)
  if ($RequestedRoot) { return (Resolve-Path $RequestedRoot).Path }
  $current = (Get-Location).Path
  if (Test-Path (Join-Path $current "frontend/src")) { return $current }
  if ((Split-Path $current -Leaf) -in @("backend", "frontend")) {
    return (Resolve-Path (Join-Path $current "..")).Path
  }
  throw "Run this script from the repository root, backend, or frontend directory."
}

$root = Resolve-RepositoryRoot -RequestedRoot $RepositoryRoot
Set-Location $root

$expectedBranch = "feature/resgo-ticket-trail-catalogue-integration"
$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $expectedBranch) {
  throw "Expected branch $expectedBranch but found $currentBranch."
}

$status = @(git status --porcelain)
if ($status.Count -gt 0) {
  $status | Write-Host
  throw "Commit or restore current work before starting the workspace/dashboard stability batch."
}

$required = @(
  "frontend/src/pages/TicketWorkspace.jsx",
  "frontend/src/pages/Dashboard.jsx",
  "frontend/src/services/api.js",
  "backend/src/routes/tickets.js",
  "frontend/package.json"
)
foreach ($file in $required) {
  if (-not (Test-Path $file)) { throw "Missing required file: $file" }
}

$reportPath = Join-Path $root "workspace-dashboard-stability-preflight.txt"
if (Test-Path $reportPath) { Remove-Item $reportPath -Force }

function Add-Section {
  param([string]$Title, [scriptblock]$Command)
  Add-Content $reportPath ""
  Add-Content $reportPath ("=" * 96)
  Add-Content $reportPath $Title
  Add-Content $reportPath ("=" * 96)
  $value = & $Command 2>&1 | Out-String -Width 300
  Add-Content $reportPath $value.TrimEnd()
}

Add-Content $reportPath "ATD WORKSPACE AND DASHBOARD STABILITY PREFLIGHT"
Add-Content $reportPath "Generated: $(Get-Date -Format o)"
Add-Content $reportPath "Branch: $currentBranch"
Add-Content $reportPath "Commit: $((git rev-parse --short HEAD).Trim())"

Add-Section "GIT CHECKPOINT" { git status -sb; git log -5 --oneline --decorate }

Add-Section "TICKET WORKSPACE PAGE AND URL STATE" {
  Select-String -Path "frontend/src/pages/TicketWorkspace.jsx" -Pattern @(
    'const \[page, setPage\]',
    'defaultPage',
    'searchParams.get\("page"\)',
    'changePage',
    'setPage\(1\)',
    'next.delete\("page"\)',
    'setSearchParams',
    'fetchTickets',
    'pagination'
  ) -Context 5,22
}

Add-Section "UNIFIED FILTER DRAFT APPLY CANCEL CLEAR" {
  Select-String -Path "frontend/src/pages/TicketWorkspace.jsx" -Pattern @(
    'filterPanelOpen',
    'draftStatuses',
    'draftAssignmentScope',
    'applyTicketFilters',
    'Apply filters',
    'Clear all',
    'Cancel',
    'setSelectedStatuses',
    'selectedStatuses'
  ) -Context 5,24
}

Add-Section "PAGINATION COMPONENTS AND CALL SITES" {
  Get-ChildItem "frontend/src" -Recurse -File -Include "*.jsx","*.js" |
    Select-String -Pattern @(
      'function PaginationBar',
      '<PaginationBar',
      'onPageChange',
      'Previous',
      'Next',
      'totalPages',
      'currentPage'
    ) -Context 4,20
}

Add-Section "HELPDESK WORKSPACE AND DASHBOARD ROUTES" {
  Get-ChildItem "frontend/src" -Recurse -File -Include "*.jsx","*.js" |
    Select-String -Pattern @(
      'Helpdesk Workspace',
      'WorkspaceDashboard',
      'Dashboard',
      '/helpdesk/tickets',
      'Ticket Workspace',
      'Critical Tickets',
      'All Tickets'
    ) -Context 4,18
}

Add-Section "DASHBOARD CARDS AND COUNTS" {
  Select-String -Path @(
    "frontend/src/pages/Dashboard.jsx",
    "backend/src/routes/tickets.js"
  ) -Pattern @(
    'summary',
    'counts',
    'critical',
    'priority',
    'all_count',
    'unresolved',
    'navigate\(',
    'Link to='
  ) -Context 4,22
}

Add-Section "NOTIFICATION POPOVER IMPLEMENTATION" {
  Get-ChildItem "frontend/src" -Recurse -File -Include "*.jsx","*.js" |
    Select-String -Pattern @(
      'notificationOpen',
      'notificationsOpen',
      'setNotification',
      'Notification',
      'Bell',
      'aria-expanded',
      'mousedown',
      'pointerdown',
      'Escape',
      'contains\(event.target\)'
    ) -Context 4,22
}

Add-Section "ACCOUNT USER MENU LOGOUT AND HEADER" {
  Get-ChildItem "frontend/src" -Recurse -File -Include "*.jsx","*.js" |
    Select-String -Pattern @(
      'Logout',
      'logout',
      'Sign out',
      'user menu',
      'Account',
      'avatar',
      'profile',
      'Sidebar',
      'Header'
    ) -Context 4,18
}

Add-Section "THEME APPEARANCE WALLPAPER PREFERENCES" {
  Get-ChildItem "frontend/src" -Recurse -File -Include "*.jsx","*.js","*.css" |
    Select-String -Pattern @(
      'prefers-color-scheme',
      'dark:',
      'theme',
      'dashboardTemplate',
      'appearance',
      'wallpaper',
      'reducedMotion',
      'localStorage',
      'user_preferences'
    ) -Context 3,16
}

Add-Section "USER PREFERENCE BACKEND STORAGE" {
  Get-ChildItem "backend/src" -Recurse -File -Include "*.js","*.sql" |
    Select-String -Pattern @(
      'preferences',
      'user_preferences',
      'settings',
      'appearance',
      'theme',
      'wallpaper',
      'dashboard_template'
    ) -Context 4,18
}

Add-Section "AUTHENTICATED SHELL AND ROUTE STRUCTURE" {
  Select-String -Path @(
    "frontend/src/App.jsx",
    "frontend/src/components/Sidebar.jsx"
  ) -Pattern @(
    'Routes',
    'Route',
    'OperationsShell',
    'WorkspaceShell',
    'Sidebar',
    'Outlet',
    'useAuth'
  ) -Context 3,20
}

Add-Section "API CLIENT AND TICKET FILTER PARAMETERS" {
  Select-String -Path @(
    "frontend/src/services/api.js",
    "backend/src/routes/tickets.js"
  ) -Pattern @(
    'ticketsApi',
    'getAll',
    'statuses',
    'assignmentScope',
    'priority',
    'per_page',
    'page',
    'counts'
  ) -Context 4,20
}

Write-Host "Workspace/dashboard stability preflight written to:" -ForegroundColor Green
Write-Host $reportPath -ForegroundColor Cyan
Write-Host "No application source files were changed." -ForegroundColor Green
Write-Host "Send the report for the Batch 1A integration scripts." -ForegroundColor Yellow
