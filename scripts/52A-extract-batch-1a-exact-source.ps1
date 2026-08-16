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

$report = Join-Path $root "batch-1a-exact-source.txt"
if (Test-Path $report) { Remove-Item $report -Force }

function Add-SourceSection {
  param(
    [string]$Title,
    [string]$Path,
    [int]$Start,
    [int]$End
  )

  if (-not (Test-Path $Path)) { throw "Missing source file: $Path" }

  Add-Content $report ""
  Add-Content $report ("=" * 90)
  Add-Content $report $Title
  Add-Content $report ("=" * 90)

  $lines = @(Get-Content $Path)
  $safeStart = [Math]::Max($Start - 1, 0)
  $safeEnd = [Math]::Min($End - 1, $lines.Count - 1)

  for ($index = $safeStart; $index -le $safeEnd; $index += 1) {
    Add-Content $report ("{0,5}: {1}" -f ($index + 1), $lines[$index])
  }
}

Add-Content $report "ATD BATCH 1A EXACT SOURCE"
Add-Content $report "Generated: $(Get-Date -Format o)"
Add-Content $report "Commit: $((git rev-parse --short HEAD).Trim())"

Add-SourceSection "TICKET WORKSPACE STATE AND URL DEFAULTS" ".\frontend\src\pages\TicketWorkspace.jsx" 220 290
Add-SourceSection "TICKET FETCH AND DEPENDENCIES" ".\frontend\src\pages\TicketWorkspace.jsx" 290 365
Add-SourceSection "FILTER CLOSE AND ACTIVE SUMMARY" ".\frontend\src\pages\TicketWorkspace.jsx" 365 420
Add-SourceSection "FILTER APPLY CLEAR AND PAGE CHANGE" ".\frontend\src\pages\TicketWorkspace.jsx" 415 480
Add-SourceSection "FILTER PANEL COMPLETE UI" ".\frontend\src\pages\TicketWorkspace.jsx" 640 860
Add-SourceSection "FIRST PAGINATION CALL SITE" ".\frontend\src\pages\TicketWorkspace.jsx" 850 880
Add-SourceSection "SECOND PAGINATION CALL SITE" ".\frontend\src\pages\TicketWorkspace.jsx" 1060 1095
Add-SourceSection "DASHBOARD STATE AND FETCH FUNCTIONS" ".\frontend\src\pages\Dashboard.jsx" 200 390
Add-SourceSection "DASHBOARD COUNTS AND NOTIFICATION HANDLERS" ".\frontend\src\pages\Dashboard.jsx" 390 550
Add-SourceSection "DASHBOARD HEADER AND NOTIFICATION MENU" ".\frontend\src\pages\Dashboard.jsx" 610 710
Add-SourceSection "DASHBOARD KPI CARDS" ".\frontend\src\pages\Dashboard.jsx" 780 830
Add-SourceSection "DASHBOARD TICKET QUEUE" ".\frontend\src\pages\Dashboard.jsx" 1360 1530

Add-Content $report ""
Add-Content $report ("=" * 90)
Add-Content $report "NOTIFICATION MENU DEFINITION"
Add-Content $report ("=" * 90)

$notificationMatches = Get-ChildItem ".\frontend\src" -Recurse -File -Include "*.jsx","*.js" |
  Select-String -Pattern 'function NotificationMenu|const NotificationMenu|export default function NotificationMenu' -Context 8,80

if ($notificationMatches) {
  Add-Content $report ($notificationMatches | Out-String -Width 280)
}
else {
  Add-Content $report "No standalone NotificationMenu definition was found."
}

if (-not (Test-Path $report)) { throw "The exact-source report was not created." }
if ((Get-Item $report).Length -lt 5000) { throw "The exact-source report is unexpectedly small." }

Write-Host "Batch 1A exact-source extraction passed." -ForegroundColor Green
Write-Host "Report: $report" -ForegroundColor Cyan
Write-Host "No application source files were changed." -ForegroundColor Green
