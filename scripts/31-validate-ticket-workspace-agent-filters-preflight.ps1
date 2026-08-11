param([string]$RepositoryRoot = (Get-Location).Path)

$ErrorActionPreference = "Stop"
Set-Location $RepositoryRoot

$reportPath = Join-Path $RepositoryRoot "ticket-workspace-agent-filters-preflight.txt"
if (-not (Test-Path $reportPath)) {
  throw "Preflight report is missing: $reportPath"
}

if ((Get-Item $reportPath).Length -lt 1500) {
  throw "Preflight report is unexpectedly small."
}

$text = Get-Content $reportPath -Raw
$requiredSections = @(
  "TICKET WORKSPACE IMPORTS AND URL STATE",
  "TICKET WORKSPACE LOAD AND API REQUEST",
  "TICKET WORKSPACE FILTER UI",
  "FRONTEND TICKET API",
  "BACKEND TICKET LIST ROUTE",
  "AUTHENTICATED USER SHAPE",
  "GROUP MEMBERSHIP ROUTES AND SCHEMA USE",
  "DATABASE GROUP MEMBERSHIP DEFINITIONS"
)

foreach ($section in $requiredSections) {
  if (-not $text.Contains($section)) {
    throw "Preflight report is missing section: $section"
  }
}

$markers = Select-String -Path @(
  "frontend/src/pages/TicketWorkspace.jsx",
  "frontend/src/services/api.js",
  "backend/src/routes/tickets.js",
  "backend/src/routes/groups.js"
) -Pattern '^(<<<<<<<|=======|>>>>>>>)'

if ($markers) {
  $markers
  throw "Merge conflict markers remain in agent-filter source files."
}

node --check "backend/src/routes/tickets.js"
if ($LASTEXITCODE -ne 0) {
  throw "Backend ticket route syntax failed during preflight validation."
}

Write-Host "Ticket Workspace agent-filter preflight validation passed." -ForegroundColor Green
Write-Host "Send ticket-workspace-agent-filters-preflight.txt for scripts 32 and 33." -ForegroundColor Cyan
