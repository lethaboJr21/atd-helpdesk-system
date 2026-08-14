param([string]$RepositoryRoot = (Get-Location).Path)

$ErrorActionPreference = "Stop"
Set-Location $RepositoryRoot

$expectedBranch = "feature/resgo-ticket-trail-catalogue-integration"
$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $expectedBranch) {
  throw "Expected branch $expectedBranch but found $currentBranch."
}

$workspacePath = "frontend/src/pages/TicketWorkspace.jsx"
$ticketsPath = "backend/src/routes/tickets.js"

# Script 44 failed on its first source anchor, before either source file was written.
# Verify that application source is still clean.
$sourceDiff = @(git diff --name-only -- $workspacePath $ticketsPath)
if ($sourceDiff.Count -gt 0) {
  $sourceDiff | Write-Host
  throw "Application source changed unexpectedly. Stop before continuing."
}

$reportPath = "unified-filter-backend-anchor-report.txt"
if (Test-Path $reportPath) { Remove-Item $reportPath -Force }

function Add-Section([string]$Title,[scriptblock]$Command) {
  Add-Content $reportPath ""
  Add-Content $reportPath ("=" * 88)
  Add-Content $reportPath $Title
  Add-Content $reportPath ("=" * 88)
  $result = & $Command 2>&1 | Out-String -Width 280
  Add-Content $reportPath $result.TrimEnd()
}

Add-Content $reportPath "Unified Multi-Select Filter Backend Anchor Report"
Add-Content $reportPath "Commit: $((git rev-parse --short HEAD).Trim())"

Add-Section "EXACT STATUS FILTER CONTEXT" {
  Select-String -Path $ticketsPath -Pattern @(
    'statusRaw',
    'statusKey',
    'req.query.status',
    'Invalid status filter',
    'Unresolved',
    'listValues',
    'listConditions'
  ) -Context 10,28
}

Add-Section "EXACT ROUTE LINES 105 TO 185" {
  $lines = Get-Content $ticketsPath
  $start = [Math]::Min(104,[Math]::Max($lines.Count-1,0))
  $end = [Math]::Min(184,$lines.Count-1)
  for($i=$start;$i -le $end;$i++) {
    "{0,5}: {1}" -f ($i+1),$lines[$i]
  }
}

Add-Section "STATUS NORMALIZER DEFINITION" {
  Select-String -Path $ticketsPath -Pattern @(
    'function status',
    'const status',
    'STATUS',
    'Waiting Approval',
    'Escalated'
  ) -Context 4,18
}

Add-Section "WORKSPACE CURRENT FILTER MARKERS" {
  Select-String -Path $workspacePath -Pattern @(
    'STATUS_TABS',
    'statusFilter',
    'selectedStatuses',
    'Filter tickets',
    'ASSIGNMENT_SCOPES.map'
  ) -Context 3,12
}

Write-Host "No application source changes were detected." -ForegroundColor Green
Write-Host "Backend anchor report written to: $reportPath" -ForegroundColor Cyan
Write-Host "Do not rerun script 44 until its backend anchor is corrected." -ForegroundColor Yellow
