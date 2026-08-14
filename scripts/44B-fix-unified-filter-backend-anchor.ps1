param([string]$RepositoryRoot = (Get-Location).Path)

$ErrorActionPreference = "Stop"
Set-Location $RepositoryRoot

$expectedBranch = "feature/resgo-ticket-trail-catalogue-integration"
$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $expectedBranch) {
  throw "Expected branch $expectedBranch but found $currentBranch."
}

$integrationScript = "scripts/44-integrate-unified-multiselect-ticket-filters.ps1"
if (-not (Test-Path $integrationScript)) {
  throw "Integration script is missing: $integrationScript"
}

$allowedReports = @(
  "unified-multiselect-ticket-filters-preflight.txt",
  "unified-filter-backend-anchor-report.txt"
)

$unexpected = @(git status --porcelain | Where-Object {
  if ($_ -match '^\?\? (.+)$') {
    return $allowedReports -notcontains $Matches[1]
  }
  return $true
})
if ($unexpected.Count -gt 0) {
  $unexpected | Write-Host
  throw "Unexpected application changes exist."
}

$sourceDiff = @(git diff --name-only -- `
  "backend/src/routes/tickets.js" `
  "frontend/src/pages/TicketWorkspace.jsx")
if ($sourceDiff.Count -gt 0) {
  $sourceDiff | Write-Host
  throw "Application source is not clean."
}

$scriptPath = (Resolve-Path $integrationScript).Path
$scriptText = [System.IO.File]::ReadAllText($scriptPath)

$oldLine = '      listConditions.push("t.status NOT IN (''Resolved'',''Closed'')");'
$newLine = '      listConditions.push(`t.status NOT IN (''Resolved'',''Closed'')`);'

if ($scriptText.Contains($oldLine)) {
  $scriptText = $scriptText.Replace($oldLine, $newLine)
  [System.IO.File]::WriteAllText(
    $scriptPath,
    $scriptText,
    (New-Object System.Text.UTF8Encoding($false))
  )
  Write-Host "Updated script 44 to match the backend template-literal status condition." -ForegroundColor Green
}
elseif ($scriptText.Contains($newLine)) {
  Write-Host "Script 44 already contains the corrected backend anchor." -ForegroundColor Yellow
}
else {
  throw "The expected backend status-condition line was not found in script 44."
}

$tokens = $null
$parseErrors = $null
[System.Management.Automation.Language.Parser]::ParseFile(
  $scriptPath,
  [ref]$tokens,
  [ref]$parseErrors
) | Out-Null

if ($parseErrors.Count -gt 0) {
  $parseErrors | ForEach-Object {
    Write-Host "$($_.Extent.StartLineNumber):$($_.Extent.StartColumnNumber) $($_.Message)" -ForegroundColor Red
  }
  throw "Patched script 44 contains PowerShell parsing errors."
}

$finalText = [System.IO.File]::ReadAllText($scriptPath)
if (-not $finalText.Contains($newLine)) {
  throw "Script 44 backend-anchor patch verification failed."
}

Write-Host "Script 44 PowerShell parsing passed." -ForegroundColor Green
Write-Host "No application source files were changed." -ForegroundColor Green
Write-Host "Script 44 is ready to run again." -ForegroundColor Cyan
