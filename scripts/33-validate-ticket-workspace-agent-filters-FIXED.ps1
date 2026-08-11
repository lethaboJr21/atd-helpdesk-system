param([string]$RepositoryRoot = (Get-Location).Path)

$ErrorActionPreference = "Stop"
Set-Location $RepositoryRoot

$backendPath = "backend/src/routes/tickets.js"
$workspacePath = "frontend/src/pages/TicketWorkspace.jsx"

$checks = @(
  @{ Path=$backendPath; Terms=@(
    'const assignmentScope=String(',
    'const allowedAssignmentScopes=new Set(["all","mine","unassigned","my-groups"]);',
    'add("t.assigned_to_user_id=?",req.user.id);',
    'conditions.push("t.assigned_to_user_id IS NULL");',
    'FROM support_group_members gm',
    'JOIN support_groups sg',
    'gm.user_id'
  )},
  @{ Path=$workspacePath; Terms=@(
    'const ASSIGNMENT_SCOPES = [',
    '{ key: "mine", label: "Assigned to Me" }',
    '{ key: "unassigned", label: "Unassigned" }',
    '{ key: "my-groups", label: "My Support Groups" }',
    'searchParams.get("assignment")',
    'searchParams.get("page")',
    'searchParams.get("search")',
    'const changeAssignmentScope = (value) =>',
    'const changePage = (nextPage) =>',
    'onPageChange={changePage}',
    'assignmentScope !== "all" ? { assignmentScope } : {}'
  )}
)

foreach ($item in $checks) {
  if (-not (Test-Path $item.Path)) { throw "Missing file: $($item.Path)" }
  $text = Get-Content $item.Path -Raw
  foreach ($term in $item.Terms) {
    if (-not $text.Contains($term)) { throw "$($item.Path) is missing: $term" }
  }
}

$workspace = Get-Content $workspacePath -Raw
foreach ($label in @("All Tickets","Assigned to Me","Unassigned","My Support Groups")) {
  $count = @(Select-String -Path $workspacePath -SimpleMatch "label: `"$label`"").Count
  if ($count -ne 1) { throw "Expected exactly one assignment label '$label'; found $count." }
}

$pageHandlerCount = @(Select-String -Path $workspacePath -SimpleMatch 'onPageChange={changePage}').Count
if ($pageHandlerCount -ne 2) { throw "Expected two URL-aware pagination handlers; found $pageHandlerCount." }

if ($workspace.Contains('searchParams.get("view") === "mine" ? { view: "mine" }')) {
  throw "Legacy frontend mine payload remains."
}
if ($workspace.Contains('/>    </OperationsShell>')) {
  throw "OperationsShell closing-tag formatting remains malformed."
}

$markers = Get-ChildItem backend/src,frontend/src -Recurse -File | Select-String -Pattern '^(<<<<<<<|=======|>>>>>>>)'
if ($markers) { $markers; throw "Conflict markers remain." }

node --check $backendPath
if ($LASTEXITCODE -ne 0) { throw "Backend ticket route syntax failed." }
node --check "backend/src/server.js"
if ($LASTEXITCODE -ne 0) { throw "Backend server syntax failed." }

Push-Location frontend
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Frontend production build failed." }
}
finally { Pop-Location }

$unsafe = @(git status --porcelain | Where-Object { $_ -match '(\.env|node_modules|(^|/)dist/|\.pem$|\.key$|backup|dump)' })
if ($unsafe.Count -gt 0) { $unsafe | Write-Host; throw "Unsafe or generated files detected." }

Write-Host "Ticket Workspace agent-filter validation passed." -ForegroundColor Green
Write-Host "Confirmed: Assigned to Me, Unassigned, My Support Groups and URL persistence." -ForegroundColor Cyan
