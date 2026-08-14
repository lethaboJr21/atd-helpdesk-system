param([string]$RepositoryRoot = (Get-Location).Path)
$ErrorActionPreference="Stop"
Set-Location $RepositoryRoot

$workspace="frontend/src/pages/TicketWorkspace.jsx"
$tickets="backend/src/routes/tickets.js"
foreach($path in @($workspace,$tickets)){if(-not(Test-Path $path)){throw "Missing $path"}}

$front=Get-Content $workspace -Raw
$back=Get-Content $tickets -Raw
$frontTerms=@(
  'const UNRESOLVED_STATUSES =',
  'const [selectedStatuses, setSelectedStatuses]',
  'const [draftStatuses, setDraftStatuses]',
  'toggleDraftStatus',
  'applyTicketFilters',
  'role="checkbox"',
  'aria-checked={selected}',
  'Ticket status',
  'All statuses',
  'Apply filters',
  'Clear all',
  '{ statuses: selectedStatuses.join(",") }',
  'searchParams.get("statuses")',
  'next.set("statuses", nextStatuses.join(","))',
  'setDraftStatuses([...UNRESOLVED_STATUSES])'
)
foreach($term in $frontTerms){if(-not$front.Contains($term)){throw "TicketWorkspace.jsx is missing: $term"}}

$backTerms=@(
  'req.query.statuses||req.query.status||"all"',
  't.status = ANY(',
  '::text[])',
  'Invalid status filter.',
  'Unresolved cannot be combined with individual statuses.'
)
foreach($term in $backTerms){if(-not$back.Contains($term)){throw "tickets.js is missing: $term"}}

if($front.Contains('STATUS_TABS.map((status) => (')){throw "Permanent status pills remain outside the Filter panel."}
if($front.Contains('const changeFilter = (value) =>')){throw "Legacy single-status handler remains."}
if($front.Contains('status: statusFilter === "All"')){throw "Legacy single-status API payload remains."}

$assignmentMapCount=[regex]::Matches($front,[regex]::Escape('ASSIGNMENT_SCOPES.map((scope) => (')).Count
if($assignmentMapCount -ne 1){throw "Assignment scope should render exactly once; found $assignmentMapCount."}
$statusMapCount=[regex]::Matches($front,[regex]::Escape('STATUS_OPTIONS.map((status) => {')).Count
if($statusMapCount -ne 1){throw "Multi-status controls should render exactly once; found $statusMapCount."}

$markers=Get-ChildItem backend/src,frontend/src -Recurse -File | Select-String -Pattern '^(<<<<<<<|=======|>>>>>>>)'
if($markers){$markers;throw "Conflict markers remain."}

node --check $tickets
if($LASTEXITCODE-ne 0){throw "Backend ticket route syntax failed."}
Push-Location frontend
try{npm run build;if($LASTEXITCODE-ne 0){throw "Frontend build failed."}}
finally{Pop-Location}

Write-Host "Unified multi-select Ticket Workspace filter validation passed." -ForegroundColor Green
Write-Host "Confirmed: one dropdown, multi-status selection, smart presets, one assignment scope and URL compatibility." -ForegroundColor Cyan
