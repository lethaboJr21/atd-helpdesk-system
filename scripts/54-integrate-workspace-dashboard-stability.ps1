param([string]$RepositoryRoot=(Get-Location).Path)
$ErrorActionPreference='Stop'
Set-Location $RepositoryRoot
$expected='feature/resgo-ticket-trail-catalogue-integration'
if((git branch --show-current).Trim() -ne $expected){throw "Run on $expected."}
$allowed=@('batch-1a-missing-anchors.txt')
$unexpected=@(git status --porcelain | Where-Object { if($_ -match '^\?\? (.+)$'){ return $allowed -notcontains $Matches[1] }; return $true })
if($unexpected.Count){$unexpected|Write-Host;throw 'Working tree contains unexpected changes.'}
$ws='frontend/src/pages/TicketWorkspace.jsx';$dash='frontend/src/pages/Dashboard.jsx';$tickets='backend/src/routes/tickets.js';$stats='backend/src/routes/stats.js'
foreach($p in @($ws,$dash,$tickets,$stats)){if(!(Test-Path $p)){throw "Missing $p"}}
$backup=Join-Path $RepositoryRoot ".git/batch-1a-backup-$(Get-Date -Format yyyyMMdd-HHmmss)";New-Item -ItemType Directory $backup -Force|Out-Null
Copy-Item $ws,$dash,$tickets,$stats $backup
$utf8=New-Object System.Text.UTF8Encoding($false)
function ReadLf($p){[IO.File]::ReadAllText((Resolve-Path $p)).Replace("`r`n","`n")}
function WriteLf($p,$s){[IO.File]::WriteAllText((Resolve-Path $p),$s,$utf8)}
function ReplaceOnce($s,$old,$new,$label){$i=$s.IndexOf($old,[StringComparison]::Ordinal);if($i-lt 0){throw "$label not found"};if($s.IndexOf($old,$i+$old.Length,[StringComparison]::Ordinal)-ge 0){throw "$label appears more than once"};$s.Remove($i,$old.Length).Insert($i,$new)}

# Ticket Workspace: stop page navigation from retriggering the debounced search reset.
$f=ReadLf $ws
$old=@'
  useEffect(() => {
    const timer = setTimeout(() => {
      const nextQuery = query.trim();
      setAppliedQuery(nextQuery);
      setPage(1);
      const next = new URLSearchParams(searchParams);
      if (nextQuery) next.set("search", nextQuery);
      else next.delete("search");
      next.delete("page");
      setSearchParams(next, { replace: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [query, searchParams, setSearchParams]);
'@
$new=@'
  useEffect(() => {
    const timer = setTimeout(() => {
      const nextQuery = query.trim();
      if (nextQuery === appliedQuery) return;
      setAppliedQuery(nextQuery);
      setPage(1);
      setSelectedTicket(null);
      setSearchParams((currentParams) => {
        const next = new URLSearchParams(currentParams);
        if (nextQuery) next.set("search", nextQuery);
        else next.delete("search");
        next.delete("page");
        return next;
      }, { replace: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [appliedQuery, query, setSearchParams]);
'@
$f=ReplaceOnce $f $old $new 'stable search effect'

# Preserve a dashboard priority preset and forward it to the ticket API.
$f=ReplaceOnce $f '  const defaultQuery = searchParams.get("search") || "";' ('  const defaultQuery = searchParams.get("search") || "";' + "`n" + '  const defaultPriority = ["Low", "Medium", "High", "Critical"].includes(searchParams.get("priority"))' + "`n" + '    ? searchParams.get("priority")' + "`n" + '    : "";') 'priority URL default'
$f=ReplaceOnce $f '  const [selectedStatuses, setSelectedStatuses] = useState(defaultStatuses);' ('  const [selectedStatuses, setSelectedStatuses] = useState(defaultStatuses);' + "`n" + '  const [selectedPriority] = useState(defaultPriority);') 'priority state'
$f=ReplaceOnce $f '        ...(appliedQuery ? { search: appliedQuery } : {}),' ('        ...(appliedQuery ? { search: appliedQuery } : {}),' + "`n" + '        ...(selectedPriority ? { priority: selectedPriority } : {}),') 'priority API parameter'
$f=ReplaceOnce $f '  }, [appliedQuery, assignmentScope, employeeExperience, page, selectedStatuses]);' '  }, [appliedQuery, assignmentScope, employeeExperience, page, selectedPriority, selectedStatuses]);' 'ticket fetch dependencies'

# Draft-only clear, explicit cancel, and separate immediate reset for the empty state.
$old=@'
  const clearAllTicketFilters = () => {
    setDraftAssignmentScope("all");
    setAssignmentScope("all");
    setDraftStatuses([]);
    setSelectedStatuses([]);
    setQuery("");
    setAppliedQuery("");
    setPage(1);
    setSelectedTicket(null);
    setFilterPanelOpen(false);
    setSearchParams(new URLSearchParams(), { replace: true });
  };
'@
$new=@'
  const clearDraftTicketFilters = () => {
    setDraftAssignmentScope("all");
    setDraftStatuses([]);
  };

  const cancelTicketFilters = () => {
    setDraftAssignmentScope(assignmentScope);
    setDraftStatuses(selectedStatuses);
    setFilterPanelOpen(false);
  };

  const resetAppliedTicketFilters = () => {
    setDraftAssignmentScope("all");
    setAssignmentScope("all");
    setDraftStatuses([]);
    setSelectedStatuses([]);
    setQuery("");
    setAppliedQuery("");
    setPage(1);
    setSelectedTicket(null);
    setFilterPanelOpen(false);
    setSearchParams(new URLSearchParams(), { replace: true });
  };
'@
$f=ReplaceOnce $f $old $new 'filter clear functions'
$f=$f.Replace(('onClick={clearAllTicketFilters}' + "`n" + '                        disabled={'),('onClick={clearDraftTicketFilters}' + "`n" + '                        disabled={'))
$f=$f.Replace(('assignmentScope === "all" &&' + "`n" + '                          !selectedStatuses.length &&' + "`n" + '                          !appliedQuery'),('draftAssignmentScope === "all" &&' + "`n" + '                          !draftStatuses.length'))
$f=$f.Replace(('onClick={clearAllTicketFilters}' + "`n" + '                    className="mt-4'),('onClick={resetAppliedTicketFilters}' + "`n" + '                    className="mt-4'))
# Add Cancel next to Apply
$old=@'
                      <button
                        type="button"
                        onClick={applyTicketFilters}
                        className="rounded-xl bg-[#172b57] px-4 py-2 text-sm font-bold text-white hover:bg-[#1f376c]"
                      >
                        Apply filters
                      </button>
'@
$new=@'
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={cancelTicketFilters}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={applyTicketFilters}
                          className="rounded-xl bg-[#172b57] px-4 py-2 text-sm font-bold text-white hover:bg-[#1f376c]"
                        >
                          Apply filters
                        </button>
                      </div>
'@
$f=ReplaceOnce $f $old $new 'filter footer apply button'
WriteLf $ws $f

# Backend: safely support priority / priorities query values.
$b=ReadLf $tickets
$anchor='  const listWhere=listConditions.length?`WHERE ${listConditions.join(" AND ")}`:"";'
$insert=@'
  const requestedPriorities=String(req.query.priorities||req.query.priority||"")
    .split(",")
    .map(value=>value.trim())
    .filter(Boolean);
  if(requestedPriorities.length){
    const normalizedPriorities=[...new Set(requestedPriorities.map(priority))];
    if(normalizedPriorities.some(value=>!value)){
      return res.status(400).json({error:"Invalid priority filter."});
    }
    listValues.push(normalizedPriorities);
    listConditions.push(`t.priority = ANY($${listValues.length}::text[])`);
  }

  const listWhere=listConditions.length?`WHERE ${listConditions.join(" AND ")}`:"";
'@
$b=ReplaceOnce $b $anchor $insert 'backend priority filter anchor'
WriteLf $tickets $b

# Dashboard: make All Tickets and Critical Tickets cards actionable.
$d=ReadLf $dash
$old=@'
                  title="Open Tickets"
                  value={formatCount(kpiStats?.open)}
                  supportingText={`${formatCount(kpiStats?.total)} total tickets in the system`}
'@
$new=@'
                  title="All Tickets"
                  value={formatCount(kpiStats?.total)}
                  supportingText={`${formatCount(kpiStats?.open)} unresolved tickets`}
                  onClick={() => navigate("/tickets")}
'@
$d=ReplaceOnce $d $old $new 'All Tickets card'
$old=@'
                  title="Critical / At Risk"
                  value={formatCount(kpiStats?.critical)}
                  supportingText="Open tickets that are critical or overdue"
'@
$new=@'
                  title="Critical Tickets"
                  value={formatCount(kpiStats?.criticalTickets ?? kpiStats?.critical)}
                  supportingText="Open tickets with Critical priority"
                  onClick={() => navigate("/tickets?priority=Critical&status=Unresolved")}
'@
$d=ReplaceOnce $d $old $new 'Critical Tickets card'
# StatCard clickable support
$old=@'
  accent,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
'@
$new=@'
  accent,
  onClick,
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={classNames(
        "w-full rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-sm",
        onClick && "transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100"
      )}
    >
'@
$d=ReplaceOnce $d $old $new 'StatCard opening'
$old=@'
      <p className="mt-2 text-sm leading-5 text-slate-500">{supportingText}</p>
    </div>
  );
}

function StatCardSkeleton
'@
$new=@'
      <p className="mt-2 text-sm leading-5 text-slate-500">{supportingText}</p>
    </Component>
  );
}

function StatCardSkeleton
'@
$d=ReplaceOnce $d $old $new 'StatCard closing'

$d=$d.Replace('onOpenWorkspace={() => navigate("/tickets")}', 'onOpenWorkspace={() => navigate("/tickets?status=Unresolved")}')
WriteLf $dash $d

# Stats: expose an exact Critical-priority count while preserving critical/at-risk.
$s=ReadLf $stats
$s=ReplaceOnce $s "COUNT(*) FILTER (WHERE status NOT IN ('Resolved','Closed'))::int AS open_tickets," ("COUNT(*) FILTER (WHERE status NOT IN ('Resolved','Closed'))::int AS open_tickets," + "`n" + "        COUNT(*) FILTER (WHERE status NOT IN ('Resolved','Closed') AND priority = 'Critical')::int AS critical_tickets,") 'critical stats query'
$s=ReplaceOnce $s '      critical: row.critical_at_risk,' ('      critical: row.critical_at_risk,' + "`n" + '      criticalTickets: row.critical_tickets,') 'critical stats response'
WriteLf $stats $s

Remove-Item 'batch-1a-missing-anchors.txt' -Force -ErrorAction SilentlyContinue
Write-Host 'Batch 1A workspace/dashboard stability integrated.' -ForegroundColor Green
Write-Host 'Run scripts/55-validate-workspace-dashboard-stability.ps1 next.' -ForegroundColor Cyan
