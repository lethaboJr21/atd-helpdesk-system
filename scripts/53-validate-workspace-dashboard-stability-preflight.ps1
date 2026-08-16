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
$reportPath = Join-Path $root "workspace-dashboard-stability-preflight.txt"
if (-not (Test-Path $reportPath)) { throw "Preflight report is missing: $reportPath" }
if ((Get-Item $reportPath).Length -lt 2500) { throw "Preflight report is unexpectedly small." }

$text = [System.IO.File]::ReadAllText($reportPath)
$sections = @(
  "TICKET WORKSPACE PAGE AND URL STATE",
  "UNIFIED FILTER DRAFT APPLY CANCEL CLEAR",
  "PAGINATION COMPONENTS AND CALL SITES",
  "HELPDESK WORKSPACE AND DASHBOARD ROUTES",
  "DASHBOARD CARDS AND COUNTS",
  "NOTIFICATION POPOVER IMPLEMENTATION",
  "ACCOUNT USER MENU LOGOUT AND HEADER",
  "THEME APPEARANCE WALLPAPER PREFERENCES",
  "USER PREFERENCE BACKEND STORAGE",
  "AUTHENTICATED SHELL AND ROUTE STRUCTURE",
  "API CLIENT AND TICKET FILTER PARAMETERS"
)
foreach ($section in $sections) {
  if (-not $text.Contains($section)) { throw "Report is missing section: $section" }
}

$markers = @(git grep -n -E '^(<<<<<<<|=======|>>>>>>>)' -- frontend/src backend/src)
if ($LASTEXITCODE -eq 0 -and $markers.Count -gt 0) {
  $markers | Write-Host
  throw "Conflict markers remain in application source."
}

node --check "backend/src/routes/tickets.js"
if ($LASTEXITCODE -ne 0) { throw "Ticket route syntax validation failed." }

Write-Host "Workspace/dashboard stability preflight validation passed." -ForegroundColor Green
Write-Host "The report is ready for Batch 1A implementation planning." -ForegroundColor Cyan
