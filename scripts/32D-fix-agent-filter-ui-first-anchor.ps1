param([string]$RepositoryRoot = (Get-Location).Path)

$ErrorActionPreference = "Stop"
Set-Location $RepositoryRoot

$expectedBranch = "feature/resgo-ticket-trail-catalogue-integration"
$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $expectedBranch) {
  throw "Expected branch $expectedBranch but found $currentBranch."
}

$integrationScript = "scripts/32-integrate-ticket-workspace-agent-filters-FIXED.ps1"
if (-not (Test-Path $integrationScript)) {
  throw "Fixed integration script is missing: $integrationScript"
}

$allowedReports = @(
  "ticket-workspace-agent-filters-preflight.txt",
  "ticket-workspace-agent-filter-ui-anchors.txt"
)

# The fixed script writes application source only after all anchors succeed.
# It stopped at the UI anchor, so application source should still be clean.
$unexpected = @(git status --porcelain | Where-Object {
  if ($_ -match '^\?\? (.+)$') { return $allowedReports -notcontains $Matches[1] }
  return $true
})

if ($unexpected.Count -gt 0) {
  $unexpected | Write-Host
  throw "Unexpected application changes exist. Do not patch automatically."
}

$scriptPath = (Resolve-Path $integrationScript).Path
$text = [System.IO.File]::ReadAllText($scriptPath)

$oldLine = '$workspace = Replace-Literal-Once $workspace $uiAnchor $uiReplacement "assignment UI location"'

$newBlock = @'
# The same pagination anchor appears twice: above and below the ticket list.
# Insert assignment scope controls before the FIRST pagination block only.
$normalizedWorkspace = $workspace.Replace("`r`n", "`n")
$normalizedUiAnchor = $uiAnchor.Replace("`r`n", "`n")
$normalizedUiReplacement = $uiReplacement.Replace("`r`n", "`n")
$uiFirst = $normalizedWorkspace.IndexOf(
  $normalizedUiAnchor,
  [System.StringComparison]::Ordinal
)
if ($uiFirst -lt 0) {
  throw "assignment UI location was not found after line-ending normalization."
}
$workspace = $normalizedWorkspace.Remove(
  $uiFirst,
  $normalizedUiAnchor.Length
).Insert(
  $uiFirst,
  $normalizedUiReplacement
)
'@.TrimEnd()

if ($text.Contains($oldLine)) {
  $text = $text.Replace($oldLine,$newBlock)
  [System.IO.File]::WriteAllText(
    $scriptPath,
    $text,
    (New-Object System.Text.UTF8Encoding($false))
  )
  Write-Host "Updated fixed script to insert assignment UI at the first pagination anchor only." -ForegroundColor Green
}
elseif ($text.Contains('Insert assignment scope controls before the FIRST pagination block only.')) {
  Write-Host "Fixed script already uses the first pagination anchor for assignment UI." -ForegroundColor Yellow
}
else {
  throw "Could not find the assignment UI replacement line in the fixed script."
}

$final = [System.IO.File]::ReadAllText($scriptPath)
if (-not $final.Contains('Insert assignment scope controls before the FIRST pagination block only.')) {
  throw "Script patch verification failed."
}

Write-Host "No application source files were changed." -ForegroundColor Green
Write-Host "Run the FIXED integration script again." -ForegroundColor Cyan
