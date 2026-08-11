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

# The fixed script writes source only after every anchor succeeds. It stopped at
# URL defaults, so application source must still be clean.
$allowedReports = @(
  "ticket-workspace-agent-filters-preflight.txt",
  "ticket-workspace-agent-filter-ui-anchors.txt"
)
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

$oldFunction = @'
function Replace-Literal-Once([string]$Text,[string]$Old,[string]$New,[string]$Label) {
  $first = $Text.IndexOf($Old,[System.StringComparison]::Ordinal)
  if ($first -lt 0) { throw "$Label was not found." }
  $second = $Text.IndexOf($Old,$first + $Old.Length,[System.StringComparison]::Ordinal)
  if ($second -ge 0) { throw "$Label appeared more than once." }
  $Text.Remove($first,$Old.Length).Insert($first,$New)
}
'@

$newFunction = @'
function Replace-Literal-Once([string]$Text,[string]$Old,[string]$New,[string]$Label) {
  # Normalize source and anchors to LF so Git/Windows line-ending differences
  # cannot make an otherwise exact source block fail to match.
  $normalizedText = $Text.Replace("`r`n", "`n")
  $normalizedOld = $Old.Replace("`r`n", "`n")
  $normalizedNew = $New.Replace("`r`n", "`n")
  $first = $normalizedText.IndexOf(
    $normalizedOld,
    [System.StringComparison]::Ordinal
  )
  if ($first -lt 0) { throw "$Label was not found after line-ending normalization." }
  $second = $normalizedText.IndexOf(
    $normalizedOld,
    $first + $normalizedOld.Length,
    [System.StringComparison]::Ordinal
  )
  if ($second -ge 0) { throw "$Label appeared more than once." }
  $normalizedText.Remove($first,$normalizedOld.Length).Insert($first,$normalizedNew)
}
'@

if ($text.Contains($oldFunction)) {
  $text = $text.Replace($oldFunction,$newFunction)
  [System.IO.File]::WriteAllText(
    $scriptPath,
    $text,
    (New-Object System.Text.UTF8Encoding($false))
  )
  Write-Host "Updated the fixed integration script with line-ending tolerant anchors." -ForegroundColor Green
}
elseif ($text.Contains('was not found after line-ending normalization')) {
  Write-Host "The fixed integration script already has line-ending tolerant anchors." -ForegroundColor Yellow
}
else {
  throw "The expected Replace-Literal-Once function was not found."
}

$final = [System.IO.File]::ReadAllText($scriptPath)
if (-not $final.Contains('was not found after line-ending normalization')) {
  throw "Line-ending patch verification failed."
}

Write-Host "No application source files were changed." -ForegroundColor Green
Write-Host "Run the FIXED integration script again." -ForegroundColor Cyan
