param([string]$RepositoryRoot = (Get-Location).Path)

$ErrorActionPreference = "Stop"
Set-Location $RepositoryRoot

$expectedBranch = "feature/resgo-ticket-trail-catalogue-integration"
$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $expectedBranch) {
  throw "Expected branch $expectedBranch but found $currentBranch."
}

$integrationScript = "scripts/28-integrate-five-request-entry-options.ps1"
if (-not (Test-Path $integrationScript)) {
  throw "Integration script is missing: $integrationScript"
}

# Restore every tracked file that script 28 can modify. This returns source to df664b2.
$trackedFiles = @(
  "backend/src/routes/tickets.js",
  "frontend/src/App.jsx",
  "frontend/src/data/requestModules.js",
  "frontend/src/pages/TicketCreatePage.jsx",
  "frontend/src/pages/TicketWorkspace.jsx"
)

git restore --worktree -- $trackedFiles
if ($LASTEXITCODE -ne 0) {
  throw "Could not restore the partially changed tracked files."
}

# Remove the new untracked component written before the integration stopped.
$menuPath = "frontend/src/components/tickets/RequestEntryMenu.jsx"
if (Test-Path $menuPath) {
  Remove-Item $menuPath -Force
}

# Remove its directory only when empty.
$menuDirectory = Split-Path $menuPath
if ((Test-Path $menuDirectory) -and -not (Get-ChildItem $menuDirectory -Force | Select-Object -First 1)) {
  Remove-Item $menuDirectory -Force
}

# Replace the too-strict one-match Project JSX insertion with responsive-layout support.
$scriptPath = (Resolve-Path $integrationScript).Path
$scriptText = [System.IO.File]::ReadAllText($scriptPath)

$oldLine = '$create = Replace-Once $create ''(?m)^(\s{12}\{ticketType === "change" \? \(\r?$)'' ($projectFields + "`n" + ''$1'') "Project JSX fields"'

$newBlock = @'
$projectFieldPattern = '(?m)^(\s{12}\{ticketType === "change" \? \(\r?$)'
$projectFieldRegex = [regex]::new(
  $projectFieldPattern,
  [System.Text.RegularExpressions.RegexOptions]::Multiline
)
$projectFieldMatches = $projectFieldRegex.Matches($create).Count
if ($projectFieldMatches -lt 1) {
  throw "Project JSX fields anchor was not found."
}
$create = $projectFieldRegex.Replace(
  $create,
  ($projectFields + "`n" + '$1')
)
Write-Host "Project fields inserted into $projectFieldMatches responsive form layout(s)." -ForegroundColor Cyan
'@.TrimEnd()

if (-not $scriptText.Contains($oldLine)) {
  if ($scriptText.Contains('$projectFieldMatches = $projectFieldRegex.Matches($create).Count')) {
    Write-Host "Integration script already contains the responsive-layout fix." -ForegroundColor Yellow
  }
  else {
    throw "The expected strict Project JSX insertion line was not found in script 28."
  }
}
else {
  $scriptText = $scriptText.Replace($oldLine, $newBlock)
  [System.IO.File]::WriteAllText(
    $scriptPath,
    $scriptText,
    (New-Object System.Text.UTF8Encoding($false))
  )
  Write-Host "Updated script 28 to support both responsive Project form layouts." -ForegroundColor Green
}

# Verify recovery and patch.
$sourceChanges = @(git status --porcelain | Where-Object {
  $_ -notmatch '^\?\? five-request-entry-preflight\.txt$'
})

if ($sourceChanges.Count -gt 0) {
  $sourceChanges | Write-Host
  throw "Unexpected changes remain after recovery."
}

$finalScript = [System.IO.File]::ReadAllText($scriptPath)
if (-not $finalScript.Contains('$projectFieldMatches = $projectFieldRegex.Matches($create).Count')) {
  throw "Script 28 responsive-layout fix verification failed."
}

Write-Host "Partial integration recovered successfully." -ForegroundColor Green
Write-Host "Source is back at the clean df664b2 checkpoint." -ForegroundColor Green
Write-Host "Script 28 is fixed and ready to run again." -ForegroundColor Cyan
