param(
  [string]$RepositoryRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
Set-Location $RepositoryRoot

$required = @(
  @{ Path="frontend/src/components/tickets/RequestEntryMenu.jsx"; Terms=@("Report an Incident","Request a Service","Change Management","Request an Asset","Create a Project") },
  @{ Path="frontend/src/pages/TicketWorkspace.jsx"; Terms=@("RequestEntryMenu","Create Request","requestEntryOpen") },
  @{ Path="frontend/src/data/requestModules.js"; Terms=@('ticketType: "project"','path: "/projects/new"','FolderKanban') },
  @{ Path="frontend/src/App.jsx"; Terms=@('path="/projects/new"','lockedType="project"') },
  @{ Path="frontend/src/pages/TicketCreatePage.jsx"; Terms=@("projectObjective","projectSponsor","projectOwner","projectStart","projectEnd","projectScope","projectDeliverables",'details.module = "project"') },
  @{ Path="backend/src/routes/tickets.js"; Terms=@('project:"PRJ"') }
)
foreach ($item in $required) {
  if (-not (Test-Path $item.Path)) { throw "Missing file: $($item.Path)" }
  $text = Get-Content $item.Path -Raw
  foreach ($term in $item.Terms) {
    if (-not $text.Contains($term)) { throw "$($item.Path) is missing: $term" }
  }
}

$menuText = Get-Content "frontend/src/components/tickets/RequestEntryMenu.jsx" -Raw
$entryKeys = @("incident","service","change","asset","project")
foreach ($key in $entryKeys) {
  $count = @(Select-String -Path "frontend/src/components/tickets/RequestEntryMenu.jsx" -SimpleMatch "key: `"$key`"").Count
  if ($count -ne 1) { throw "Expected exactly one $key menu entry; found $count." }
}
if ($menuText.Contains("Request an Asset or Create a Project")) { throw "Asset and Project were incorrectly combined." }

$markers = Get-ChildItem backend/src,frontend/src -Recurse -File | Select-String -Pattern '^(<<<<<<<|=======|>>>>>>>)'
if ($markers) { $markers; throw "Conflict markers remain." }

node --check "backend/src/routes/tickets.js"
if ($LASTEXITCODE -ne 0) { throw "Backend ticket route syntax failed." }
node --check "backend/src/server.js"
if ($LASTEXITCODE -ne 0) { throw "Backend server syntax failed." }

Push-Location frontend
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Frontend build failed." }
}
finally { Pop-Location }

$unsafe = @(git status --porcelain | Where-Object { $_ -match '(\.env|node_modules|(^|/)dist/|\.pem$|\.key$|backup|dump)' })
if ($unsafe.Count -gt 0) { $unsafe | Write-Host; throw "Unsafe or generated files detected in Git status." }

Write-Host "Five request entry validation passed." -ForegroundColor Green
Write-Host "Confirmed: Incident, Service, Change, Asset and Project are separate." -ForegroundColor Cyan
