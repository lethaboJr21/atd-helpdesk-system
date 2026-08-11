param([string]$RepositoryRoot = (Get-Location).Path)

$ErrorActionPreference = "Stop"
Set-Location $RepositoryRoot

if (-not (Test-Path ".git")) {
  throw "Run this script from the ATD Helpdesk repository root."
}

$expectedBranch = "feature/resgo-ticket-trail-catalogue-integration"
$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $expectedBranch) {
  throw "Expected branch $expectedBranch but found $currentBranch."
}

$status = @(git status --porcelain)
if ($status.Count -gt 0) {
  $status | Write-Host
  throw "The working tree must be clean before this preflight."
}

$requiredFiles = @(
  "frontend/src/pages/TicketWorkspace.jsx",
  "frontend/src/services/api.js",
  "frontend/src/context/AuthContext.jsx",
  "backend/src/routes/tickets.js",
  "backend/src/routes/groups.js",
  "backend/src/middleware/auth.js",
  "frontend/package.json"
)

foreach ($file in $requiredFiles) {
  if (-not (Test-Path $file)) {
    throw "Required file is missing: $file"
  }
}

$reportPath = Join-Path $RepositoryRoot "ticket-workspace-agent-filters-preflight.txt"
if (Test-Path $reportPath) {
  Remove-Item $reportPath -Force
}

function Add-Section {
  param([string]$Title,[scriptblock]$Command)

  Add-Content -Path $reportPath -Value ""
  Add-Content -Path $reportPath -Value ("=" * 88)
  Add-Content -Path $reportPath -Value $Title
  Add-Content -Path $reportPath -Value ("=" * 88)
  $result = & $Command 2>&1 | Out-String -Width 260
  Add-Content -Path $reportPath -Value $result.TrimEnd()
}

Add-Content -Path $reportPath -Value "ATD Ticket Workspace Agent Filters Preflight"
Add-Content -Path $reportPath -Value "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Add-Content -Path $reportPath -Value "Branch: $currentBranch"
Add-Content -Path $reportPath -Value "Commit: $((git rev-parse --short HEAD).Trim())"

Add-Section "GIT STATUS" { git status -sb }

Add-Section "TICKET WORKSPACE IMPORTS AND URL STATE" {
  Select-String -Path "frontend/src/pages/TicketWorkspace.jsx" -Pattern @(
    '^import ',
    'useSearchParams',
    'searchParams',
    'setSearchParams',
    'useAuth',
    'const \{ user',
    'pageSize',
    'page',
    'status',
    'search',
    'filters',
    'query'
  ) -Context 3,12
}

Add-Section "TICKET WORKSPACE LOAD AND API REQUEST" {
  Select-String -Path "frontend/src/pages/TicketWorkspace.jsx" -Pattern @(
    'ticketsApi',
    'getTickets',
    'listTickets',
    'loadTickets',
    'fetchTickets',
    'useEffect',
    'URLSearchParams',
    'setPage',
    'setSelectedTicket',
    'total',
    'counts'
  ) -Context 4,16
}

Add-Section "TICKET WORKSPACE FILTER UI" {
  Select-String -Path "frontend/src/pages/TicketWorkspace.jsx" -Pattern @(
    'Search tickets',
    'Unresolved',
    'Assigned',
    'Unassigned',
    'My Tickets',
    'Support Group',
    'statusTabs',
    'STATUSES',
    'button',
    'select'
  ) -Context 4,14
}

Add-Section "FRONTEND TICKET API" {
  Select-String -Path "frontend/src/services/api.js" -Pattern @(
    'ticketsApi',
    'getTickets',
    'listTickets',
    '/tickets',
    'params',
    'page',
    'limit',
    'status',
    'search',
    'assignee',
    'group'
  ) -Context 4,16
}

Add-Section "BACKEND TICKET LIST ROUTE" {
  Select-String -Path "backend/src/routes/tickets.js" -Pattern @(
    'router\.get\("/"',
    'request\.query',
    'page',
    'limit',
    'status',
    'search',
    'assigned_to_user_id',
    'assigned_group_id',
    'support_groups',
    'group_members',
    'COUNT\(',
    'total',
    'counts',
    'ORDER BY',
    'LIMIT',
    'OFFSET'
  ) -Context 4,22
}

Add-Section "AUTHENTICATED USER SHAPE" {
  Select-String -Path @(
    "backend/src/middleware/auth.js",
    "frontend/src/context/AuthContext.jsx"
  ) -Pattern @(
    'request\.user',
    'req\.user',
    'user\.id',
    'user_id',
    'role',
    'email',
    'permissions'
  ) -Context 3,12
}

Add-Section "GROUP MEMBERSHIP ROUTES AND SCHEMA USE" {
  Select-String -Path @(
    "backend/src/routes/groups.js",
    "backend/src/routes/tickets.js"
  ) -Pattern @(
    'support_group',
    'group_member',
    'agent',
    'user_id',
    'member_id',
    'assigned_group_id',
    'is_active'
  ) -Context 3,14
}

Add-Section "DATABASE GROUP MEMBERSHIP DEFINITIONS" {
  Get-ChildItem "backend/src/db/migrations" -File -Filter "*.sql" |
    Select-String -Pattern @(
      'CREATE TABLE.*support',
      'group_members',
      'support_group_members',
      'agent_group',
      'assigned_group_id',
      'user_id',
      'is_active'
    ) -Context 2,8
}

Add-Section "EXISTING FILTER TESTS OR SCRIPTS" {
  Get-ChildItem . -Recurse -File -Include "*.test.js","*.spec.js","*.ps1" |
    Select-String -Pattern @(
      'assignee=me',
      'unassigned',
      'my groups',
      'my_groups',
      'Ticket Workspace',
      'ticket filter'
    ) -Context 2,4
}

Write-Host "Ticket Workspace agent-filter preflight written to:" -ForegroundColor Green
Write-Host $reportPath -ForegroundColor Cyan
Write-Host "No source files were changed." -ForegroundColor Green
