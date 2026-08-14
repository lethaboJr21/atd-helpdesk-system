param([string]$RepositoryRoot = (Get-Location).Path)

$ErrorActionPreference = "Stop"
Set-Location $RepositoryRoot

if (-not (Test-Path ".git")) { throw "Run this script from the ATD Helpdesk repository root." }

$expectedBranch = "feature/resgo-ticket-trail-catalogue-integration"
$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $expectedBranch) { throw "Expected branch $expectedBranch but found $currentBranch." }

$status = @(git status --porcelain)
if ($status.Count -gt 0) {
  $status | Write-Host
  throw "The working tree must be clean before unified-filter preflight."
}

$required = @(
  "frontend/src/pages/TicketWorkspace.jsx",
  "frontend/src/services/api.js",
  "backend/src/routes/tickets.js",
  "frontend/package.json"
)
foreach ($file in $required) { if (-not (Test-Path $file)) { throw "Missing file: $file" } }

$report = Join-Path $RepositoryRoot "unified-multiselect-ticket-filters-preflight.txt"
if (Test-Path $report) { Remove-Item $report -Force }

function Add-Section([string]$Title,[scriptblock]$Command) {
  Add-Content $report ""
  Add-Content $report ("=" * 92)
  Add-Content $report $Title
  Add-Content $report ("=" * 92)
  $value = & $Command 2>&1 | Out-String -Width 280
  Add-Content $report $value.TrimEnd()
}

Add-Content $report "ATD Unified Multi-Select Ticket Filters Preflight"
Add-Content $report "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Add-Content $report "Branch: $currentBranch"
Add-Content $report "Commit: $((git rev-parse --short HEAD).Trim())"

Add-Section "GIT STATUS" { git status -sb }

Add-Section "STATUS AND ASSIGNMENT CONSTANTS" {
  Select-String -Path "frontend/src/pages/TicketWorkspace.jsx" -Pattern @(
    'STATUS_TABS',
    'ASSIGNMENT_SCOPES',
    'ASSIGNMENT_SCOPE_KEYS',
    'Unresolved',
    'Waiting Approval',
    'Escalated'
  ) -Context 3,18
}

Add-Section "FILTER PANEL IMPLEMENTATION" {
  Select-String -Path "frontend/src/pages/TicketWorkspace.jsx" -Pattern @(
    'filterPanelOpen',
    'draftAssignmentScope',
    'Filter tickets',
    'Apply filter',
    'clearAssignmentFilter',
    'clearAllTicketFilters',
    'activeFilterCount',
    'activeAssignmentLabel'
  ) -Context 5,24
}

Add-Section "STATUS STATE AND URL PERSISTENCE" {
  Select-String -Path "frontend/src/pages/TicketWorkspace.jsx" -Pattern @(
    'defaultStatus',
    'statusFilter',
    'changeFilter',
    'searchParams.get\("status"\)',
    'next.set\("status"',
    'next.delete\("status"',
    'setStatusFilter',
    'setSearchParams'
  ) -Context 4,18
}

Add-Section "CURRENT STATUS PILLS UI" {
  Select-String -Path "frontend/src/pages/TicketWorkspace.jsx" -Pattern @(
    'STATUS_TABS.map',
    'statusCount\(status\)',
    'statusFilter === status',
    'changeFilter\(status\)'
  ) -Context 10,28
}

Add-Section "TICKET API PAYLOAD" {
  Select-String -Path "frontend/src/pages/TicketWorkspace.jsx" -Pattern @(
    'ticketsApi.getAll',
    'status:',
    'assignmentScope',
    'search:',
    'per_page',
    'page,'
    'fetchTickets'
  ) -Context 5,20
}

Add-Section "BACKEND STATUS FILTER SQL" {
  Select-String -Path "backend/src/routes/tickets.js" -Pattern @(
    'req.query.status',
    'status',
    'Unresolved',
    'Resolved',
    'Closed',
    'ANY',
    'IN\(',
    'conditions',
    'add\('
  ) -Context 4,24
}

Add-Section "COUNTS AND PAGINATION" {
  Select-String -Path @(
    "frontend/src/pages/TicketWorkspace.jsx",
    "backend/src/routes/tickets.js"
  ) -Pattern @(
    'counts',
    'statusCount',
    'pagination',
    'totalPages',
    'COUNT\(',
    'statusCounts'
  ) -Context 4,18
}

Add-Section "EMPTY STATE AND ACTIVE FILTER SUMMARY" {
  Select-String -Path "frontend/src/pages/TicketWorkspace.jsx" -Pattern @(
    'No tickets match',
    'No tickets in your support groups',
    'hasSearchOrStatusFilter',
    'Clear filters',
    'Assignment scope'
  ) -Context 5,18
}

Add-Section "AVAILABLE CHECKBOX AND MULTISELECT PATTERNS" {
  Get-ChildItem "frontend/src" -Recurse -File -Include "*.jsx","*.js" |
    Select-String -Pattern @(
      'type="checkbox"',
      'aria-checked',
      'Set\(',
      'selectedStatuses',
      'multi-select',
      'toggleSelection'
    ) -Context 2,8
}

Write-Host "Unified multi-select filter preflight written to:" -ForegroundColor Green
Write-Host $report -ForegroundColor Cyan
Write-Host "No source files were changed." -ForegroundColor Green
