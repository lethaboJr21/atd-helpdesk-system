param([string]$RepositoryRoot = "")

$ErrorActionPreference = "Stop"

if ($RepositoryRoot) {
  $root = (Resolve-Path $RepositoryRoot).Path
}
elseif (Test-Path (Join-Path (Get-Location).Path "frontend/src")) {
  $root = (Get-Location).Path
}
elseif ((Split-Path (Get-Location).Path -Leaf) -in @("backend", "frontend")) {
  $root = (Resolve-Path "..").Path
}
else {
  throw "Run this script from the repository root, backend, or frontend directory."
}

Set-Location $root

$report = Join-Path $root "batch-1a-missing-anchors.txt"
if (Test-Path $report) { Remove-Item $report -Force }

function Add-Matches {
  param(
    [string]$Title,
    [string[]]$Paths,
    [string[]]$Patterns,
    [int]$Before = 8,
    [int]$After = 35
  )

  Add-Content $report ""
  Add-Content $report ("=" * 96)
  Add-Content $report $Title
  Add-Content $report ("=" * 96)

  $matches = Select-String -Path $Paths -Pattern $Patterns -SimpleMatch -Context $Before,$After
  if ($matches) {
    Add-Content $report ($matches | Out-String -Width 320)
  }
  else {
    Add-Content $report "No matches found."
  }
}

Add-Content $report "ATD BATCH 1A REMAINING IMPLEMENTATION ANCHORS"
Add-Content $report "Generated: $(Get-Date -Format o)"
Add-Content $report "Commit: $((git rev-parse --short HEAD).Trim())"

Add-Matches "DASHBOARD STAT CARD DEFINITION AND ALL CALLS" `
  @("frontend/src/pages/Dashboard.jsx") `
  @("function StatCard", "const StatCard", "<StatCard") 10 55

Add-Matches "DASHBOARD TICKET QUEUE CALL SITE" `
  @("frontend/src/pages/Dashboard.jsx") `
  @("<TicketQueue", "onOpenWorkspace=", "filteredTickets") 12 45

Add-Matches "DASHBOARD OPEN WORKSPACE HANDLER" `
  @("frontend/src/pages/Dashboard.jsx") `
  @('openTicketWorkspace', 'onOpenWorkspace', 'navigate\("/tickets', "navigate\('/tickets") 10 30

Add-Matches "TICKET WORKSPACE IMPORTS AND FILTER CONSTANTS" `
  @("frontend/src/pages/TicketWorkspace.jsx") `
  @("^import ", "STATUS_OPTIONS", "ASSIGNMENT_SCOPES", "PAGE_SIZE") 2 18

Add-Matches "BACKEND PRIORITY FILTER AND DASHBOARD STATS" `
  @("backend/src/routes/tickets.js", "backend/src/routes/stats.js", "backend/src/services/*.js") `
  @("req.query.priority", "priorities", "critical", "all_count", "COUNT(*) FILTER", "getDashboard") 6 35

Add-Matches "FRONTEND API STATS AND TICKETS" `
  @("frontend/src/services/api.js") `
  @("ticketsApi", "statsApi", "getDashboard") 5 25

Add-Matches "DASHBOARD NOTIFICATION IMPORTS AND REFS" `
  @("frontend/src/pages/Dashboard.jsx") `
  @("^import ", "useRef", "NotificationMenu") 2 18

Add-Matches "CURRENT TICKET WORKSPACE SEARCH EFFECT" `
  @("frontend/src/pages/TicketWorkspace.jsx") `
  @("const \[appliedQuery", "setAppliedQuery", "\[query, searchParams, setSearchParams\]") 8 28

Add-Matches "CURRENT FILTER FOOTER AND EMPTY-STATE CLEAR" `
  @("frontend/src/pages/TicketWorkspace.jsx") `
  @("clearAllTicketFilters", "Clear all", "Clear filters") 8 25

if (-not (Test-Path $report)) { throw "Missing report: $report" }
if ((Get-Item $report).Length -lt 4000) { throw "Report is unexpectedly small." }

Write-Host "Batch 1A missing-anchor extraction passed." -ForegroundColor Green
Write-Host "Report: $report" -ForegroundColor Cyan
Write-Host "No application source files were changed." -ForegroundColor Green
