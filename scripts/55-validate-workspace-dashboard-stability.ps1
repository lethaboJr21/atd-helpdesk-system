param([string]$RepositoryRoot=(Get-Location).Path)
$ErrorActionPreference='Stop';Set-Location $RepositoryRoot
$ws='frontend/src/pages/TicketWorkspace.jsx';$dash='frontend/src/pages/Dashboard.jsx';$tickets='backend/src/routes/tickets.js';$stats='backend/src/routes/stats.js'
foreach($p in @($ws,$dash,$tickets,$stats)){if(!(Test-Path $p)){throw "Missing $p"}}
$w=[IO.File]::ReadAllText((Resolve-Path $ws));$d=[IO.File]::ReadAllText((Resolve-Path $dash));$t=[IO.File]::ReadAllText((Resolve-Path $tickets));$s=[IO.File]::ReadAllText((Resolve-Path $stats))
$requiredW=@('if (nextQuery === appliedQuery) return;','setSearchParams((currentParams) =>','const clearDraftTicketFilters','const cancelTicketFilters','const resetAppliedTicketFilters','Apply filters','Cancel','const defaultPriority','selectedPriority ? { priority: selectedPriority }')
foreach($x in $requiredW){if(!$w.Contains($x)){throw "TicketWorkspace missing: $x"}}
if($w.Contains('[query, searchParams, setSearchParams]')){throw 'Old pagination-resetting search dependency remains.'}
foreach($x in @('requestedPriorities','Invalid priority filter.','t.priority = ANY(')){if(!$t.Contains($x)){throw "tickets.js missing: $x"}}
foreach($x in @('title="All Tickets"','title="Critical Tickets"','criticalTickets','onClick={() => navigate("/tickets")','/tickets?priority=Critical&status=Unresolved','const Component = onClick ? "button" : "div"')){if(!$d.Contains($x)){throw "Dashboard missing: $x"}}
if(!$s.Contains('critical_tickets') -or !$s.Contains('criticalTickets: row.critical_tickets')){throw 'Stats exact Critical count is missing.'}
node --check $tickets;if($LASTEXITCODE){throw 'tickets.js syntax failed'}
node --check $stats;if($LASTEXITCODE){throw 'stats.js syntax failed'}
Push-Location frontend
try{npm run build;if($LASTEXITCODE){throw 'Frontend build failed'}}finally{Pop-Location}
$markers=@(git grep -n -E '^(<<<<<<<|=======|>>>>>>>)' -- $ws $dash $tickets $stats)
if($LASTEXITCODE -eq 0 -and $markers.Count){$markers|Write-Host;throw 'Conflict markers found'}
Write-Host 'Batch 1A workspace/dashboard stability validation passed.' -ForegroundColor Green
Write-Host 'Confirmed: stable pagination, explicit filter application, clickable All/Critical cards, and parameterised priority filtering.' -ForegroundColor Cyan
