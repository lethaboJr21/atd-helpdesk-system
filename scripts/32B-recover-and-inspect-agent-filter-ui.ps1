param([string]$RepositoryRoot = (Get-Location).Path)

$ErrorActionPreference = "Stop"
Set-Location $RepositoryRoot

$expectedBranch = "feature/resgo-ticket-trail-catalogue-integration"
$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $expectedBranch) {
  throw "Expected branch $expectedBranch but found $currentBranch."
}

$trackedFiles = @(
  "backend/src/routes/tickets.js",
  "frontend/src/pages/TicketWorkspace.jsx"
)

# Script 32 can modify only these two application files before stopping.
git restore --worktree -- $trackedFiles
if ($LASTEXITCODE -ne 0) {
  throw "Could not restore the partially modified application files."
}

$unexpected = @(git status --porcelain | Where-Object {
  $_ -notmatch '^\?\? ticket-workspace-agent-filters-preflight\.txt$'
})
if ($unexpected.Count -gt 0) {
  $unexpected | Write-Host
  throw "Unexpected changes remain after recovery."
}

$workspacePath = "frontend/src/pages/TicketWorkspace.jsx"
$reportPath = "ticket-workspace-agent-filter-ui-anchors.txt"
if (Test-Path $reportPath) { Remove-Item $reportPath -Force }

function Add-Section([string]$Title,[scriptblock]$Command) {
  Add-Content $reportPath ""
  Add-Content $reportPath ("=" * 84)
  Add-Content $reportPath $Title
  Add-Content $reportPath ("=" * 84)
  $result = & $Command 2>&1 | Out-String -Width 260
  Add-Content $reportPath $result.TrimEnd()
}

Add-Content $reportPath "Ticket Workspace Agent Filter UI Anchor Report"
Add-Content $reportPath "Commit: $((git rev-parse --short HEAD).Trim())"

Add-Section "FILTER AREA AROUND STATUS TABS" {
  Select-String -Path $workspacePath -Pattern @(
    'STATUS_TABS\.map',
    'statusTabs\.map',
    'setStatusFilter',
    'changeStatus',
    'statusFilter ===',
    'Search tickets'
  ) -Context 14,30
}

Add-Section "PAGINATION AREAS" {
  Select-String -Path $workspacePath -Pattern @(
    '<PaginationBar',
    'onPageChange=',
    'showingFrom',
    'showingTo',
    'totalPages'
  ) -Context 12,24
}

Add-Section "OPERATIONS-ONLY CONDITIONALS" {
  Select-String -Path $workspacePath -Pattern @(
    '!employeeExperience',
    'operationsUser',
    'canOperate',
    'shrink-0 border-t',
    'border-slate-100 p-3'
  ) -Context 10,24
}

Add-Section "RETURN STRUCTURE AND OPERATIONS SHELL CLOSING" {
  Select-String -Path $workspacePath -Pattern @(
    '<OperationsShell',
    '</OperationsShell>',
    'return \('
  ) -Context 8,18
}

Add-Section "EXACT LINES 430 TO 590" {
  $all = Get-Content $workspacePath
  $start = [Math]::Min(429, [Math]::Max($all.Count - 1, 0))
  $end = [Math]::Min(589, $all.Count - 1)
  for ($i=$start; $i -le $end; $i++) {
    "{0,5}: {1}" -f ($i + 1), $all[$i]
  }
}

Add-Section "EXACT LINES 690 TO 790" {
  $all = Get-Content $workspacePath
  $start = [Math]::Min(689, [Math]::Max($all.Count - 1, 0))
  $end = [Math]::Min(789, $all.Count - 1)
  for ($i=$start; $i -le $end; $i++) {
    "{0,5}: {1}" -f ($i + 1), $all[$i]
  }
}

Write-Host "Partial agent-filter integration recovered." -ForegroundColor Green
Write-Host "Application source is back at the last committed checkpoint." -ForegroundColor Green
Write-Host "UI anchor report written to: $reportPath" -ForegroundColor Cyan
Write-Host "Do not rerun script 32 until its UI anchor is corrected." -ForegroundColor Yellow
