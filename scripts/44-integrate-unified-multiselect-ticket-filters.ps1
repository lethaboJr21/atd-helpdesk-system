param([string]$RepositoryRoot = (Get-Location).Path)

$ErrorActionPreference = "Stop"
Set-Location $RepositoryRoot

$expectedBranch = "feature/resgo-ticket-trail-catalogue-integration"
if ((git branch --show-current).Trim() -ne $expectedBranch) {
  throw "Run this script on $expectedBranch."
}

$allowedReport = "unified-multiselect-ticket-filters-preflight.txt"
$unexpected = @(git status --porcelain | Where-Object {
  if ($_ -match '^\?\? (.+)$') { return $Matches[1] -ne $allowedReport }
  return $true
})
if ($unexpected.Count -gt 0) {
  $unexpected | Write-Host
  throw "Working tree contains unexpected changes."
}

$workspacePath = "frontend/src/pages/TicketWorkspace.jsx"
$ticketsPath = "backend/src/routes/tickets.js"
foreach ($path in @($workspacePath,$ticketsPath)) {
  if (-not (Test-Path $path)) { throw "Missing source file: $path" }
}

$backup = Join-Path $RepositoryRoot ".git/unified-ticket-filters-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Copy-Item $workspacePath (Join-Path $backup "TicketWorkspace.jsx") -Force
Copy-Item $ticketsPath (Join-Path $backup "tickets.js") -Force
Write-Host "Backup created: $backup" -ForegroundColor Cyan

$encoding = New-Object System.Text.UTF8Encoding($false)
function Read-Lf([string]$Path) {
  [System.IO.File]::ReadAllText((Resolve-Path $Path).Path).Replace("`r`n","`n")
}
function Write-Utf8([string]$Path,[string]$Text) {
  [System.IO.File]::WriteAllText((Resolve-Path $Path).Path,$Text,$encoding)
}
function Replace-Once([string]$Text,[string]$Old,[string]$New,[string]$Label) {
  $oldLf=$Old.Replace("`r`n","`n"); $newLf=$New.Replace("`r`n","`n")
  $first=$Text.IndexOf($oldLf,[System.StringComparison]::Ordinal)
  if($first -lt 0){throw "$Label was not found."}
  if($Text.IndexOf($oldLf,$first+$oldLf.Length,[System.StringComparison]::Ordinal) -ge 0){throw "$Label appeared more than once."}
  $Text.Remove($first,$oldLf.Length).Insert($first,$newLf)
}

# -----------------------------------------------------------------------------
# Backend: safely support comma-separated multi-status filtering.
# -----------------------------------------------------------------------------
$backend = Read-Lf $ticketsPath
if ($backend.Contains('const requestedStatuses=String(req.query.statuses||req.query.status||"all")')) {
  throw "Backend multi-status filtering already appears installed."
}

$oldBackendStatus = @'
  const statusRaw=String(req.query.status||"all").trim();
  const statusKey=statusRaw.toLowerCase();
  const listValues=[...values];
  const listConditions=[...conditions];
  if(statusKey&&statusKey!=="all"){
    if(statusKey==="unresolved"){
      listConditions.push(`t.status NOT IN ('Resolved','Closed')`);
    }else{
      const normalized=status(statusRaw);
      if(!normalized)return res.status(400).json({error:"Invalid status filter."});
      listValues.push(normalized);
      listConditions.push(`t.status=$${listValues.length}`);
    }
  }
'@
$newBackendStatus = @'
  const requestedStatuses=String(req.query.statuses||req.query.status||"all")
    .split(",")
    .map(value=>value.trim())
    .filter(Boolean);
  const statusKeys=requestedStatuses.map(value=>value.toLowerCase());
  const listValues=[...values];
  const listConditions=[...conditions];
  if(!statusKeys.includes("all")&&requestedStatuses.length){
    if(statusKeys.includes("unresolved")){
      if(requestedStatuses.length!==1){
        return res.status(400).json({error:"Unresolved cannot be combined with individual statuses."});
      }
      listConditions.push(`t.status NOT IN ('Resolved','Closed')`);
    }else{
      const normalizedStatuses=[...new Set(requestedStatuses.map(status))];
      if(normalizedStatuses.some(value=>!value)){
        return res.status(400).json({error:"Invalid status filter."});
      }
      listValues.push(normalizedStatuses);
      listConditions.push(`t.status = ANY($${listValues.length}::text[])`);
    }
  }
'@
$backend = Replace-Once $backend $oldBackendStatus $newBackendStatus "backend status filter"

# -----------------------------------------------------------------------------
# Frontend: one unified panel, multi-select statuses, single assignment scope.
# -----------------------------------------------------------------------------
$front = Read-Lf $workspacePath
if ($front.Contains('const UNRESOLVED_STATUSES = [')) {
  throw "Frontend multi-status filtering already appears installed."
}

$front = Replace-Once $front @'
const STATUS_TABS = ["All", "Unresolved", ...STATUS_OPTIONS];
const PAGE_SIZE = 30;
'@ @'
const STATUS_TABS = ["All", "Unresolved", ...STATUS_OPTIONS];
const UNRESOLVED_STATUSES = STATUS_OPTIONS.filter(
  (status) => !["Resolved", "Closed"].includes(status)
);
const STATUS_OPTION_KEYS = new Set(STATUS_OPTIONS);
const PAGE_SIZE = 30;

function normalizeStatusSelection(values, fallback = []) {
  const clean = [...new Set(values)].filter((value) => STATUS_OPTION_KEYS.has(value));
  return clean.length ? clean : [...fallback];
}

function sameStatuses(left, right) {
  return left.length === right.length && left.every((value) => right.includes(value));
}
'@ "status constants"

$front = Replace-Once $front @'
  const defaultStatus =
    searchParams.get("status") || (employeeExperience ? "All" : "Unresolved");
'@ @'
  const legacyStatus = searchParams.get("status");
  const statusQuery = searchParams.get("statuses");
  const defaultStatuses = statusQuery
    ? normalizeStatusSelection(statusQuery.split(","))
    : legacyStatus === "All"
      ? []
      : legacyStatus === "Unresolved" || (!legacyStatus && !employeeExperience)
        ? [...UNRESOLVED_STATUSES]
        : legacyStatus && STATUS_OPTION_KEYS.has(legacyStatus)
          ? [legacyStatus]
          : [];
'@ "status URL defaults"

$front = Replace-Once $front @'
  const [statusFilter, setStatusFilter] = useState(
    STATUS_TABS.includes(defaultStatus) ? defaultStatus : "All"
  );
'@ @'
  const [selectedStatuses, setSelectedStatuses] = useState(defaultStatuses);
'@ "selected status state"

$front = Replace-Once $front @'
  const [draftAssignmentScope, setDraftAssignmentScope] = useState(
    defaultAssignmentScope
  );
'@ @'
  const [draftAssignmentScope, setDraftAssignmentScope] = useState(
    defaultAssignmentScope
  );
  const [draftStatuses, setDraftStatuses] = useState(defaultStatuses);
'@ "draft status state"

$front = Replace-Once $front @'
        const filtered = data.filter((item) => {
          if (statusFilter === "All") return true;
          if (statusFilter === "Unresolved") {
            return !["Resolved", "Closed"].includes(item.status);
          }
          return item.status === statusFilter;
        });
'@ @'
        const filtered = data.filter(
          (item) => !selectedStatuses.length || selectedStatuses.includes(item.status)
        );
'@ "employee status filtering"

$front = Replace-Once $front @'
        status: statusFilter === "All" ? undefined : statusFilter,
'@ @'
        ...(selectedStatuses.length
          ? { statuses: selectedStatuses.join(",") }
          : {}),
'@ "ticket API statuses"

$front = Replace-Once $front @'
  }, [appliedQuery, assignmentScope, employeeExperience, page, statusFilter]);
'@ @'
  }, [appliedQuery, assignmentScope, employeeExperience, page, selectedStatuses]);
'@ "fetch dependencies"

$front = Replace-Once $front @'
  const activeAssignmentLabel =
    ASSIGNMENT_SCOPES.find((scope) => scope.key === assignmentScope)?.label ||
    "All Tickets";
  const activeFilterCount = assignmentScope === "all" ? 0 : 1;
  const hasSearchOrStatusFilter =
    Boolean(appliedQuery) || statusFilter !== (employeeExperience ? "All" : "Unresolved");
'@ @'
  const activeAssignmentLabel =
    ASSIGNMENT_SCOPES.find((scope) => scope.key === assignmentScope)?.label ||
    "All Tickets";
  const unresolvedSelected = sameStatuses(selectedStatuses, UNRESOLVED_STATUSES);
  const activeStatusLabel = !selectedStatuses.length
    ? "All statuses"
    : unresolvedSelected
      ? "Unresolved"
      : selectedStatuses.length === 1
        ? selectedStatuses[0]
        : `${selectedStatuses.length} statuses`;
  const activeFilterCount =
    (assignmentScope === "all" ? 0 : 1) + (selectedStatuses.length ? 1 : 0);
  const hasSearchOrStatusFilter = Boolean(appliedQuery) || selectedStatuses.length > 0;
'@ "active filter summary"

# Remove obsolete single-status handler and replace all filter apply/clear handlers.
$oldHandlers = @'
  const changeFilter = (value) => {
    setStatusFilter(value);
    setPage(1);
    setSelectedTicket(null);
    const next = new URLSearchParams(searchParams);
    if (value === "All") next.delete("status");
    else next.set("status", value);
    next.delete("page");
    setSearchParams(next, { replace: true });
  };


  const applyAssignmentScope = (value) => {
    const nextValue = ASSIGNMENT_SCOPE_KEYS.has(value) ? value : "all";
    setAssignmentScope(nextValue);
    setPage(1);
    setSelectedTicket(null);
    const next = new URLSearchParams(searchParams);
    next.delete("view");
    if (nextValue === "all") next.delete("assignment");
    else next.set("assignment", nextValue);
    next.delete("page");
    setSearchParams(next, { replace: true });
    setFilterPanelOpen(false);
  };

  const clearAssignmentFilter = () => {
    setDraftAssignmentScope("all");
    applyAssignmentScope("all");
  };

  const clearAllTicketFilters = () => {
    const defaultStatusValue = employeeExperience ? "All" : "Unresolved";
    setDraftAssignmentScope("all");
    setAssignmentScope("all");
    setStatusFilter(defaultStatusValue);
    setQuery("");
    setAppliedQuery("");
    setPage(1);
    setSelectedTicket(null);
    setFilterPanelOpen(false);
    setSearchParams(new URLSearchParams(), { replace: true });
  };
'@
$newHandlers = @'
  const toggleDraftStatus = (value) => {
    setDraftStatuses((current) =>
      current.includes(value)
        ? current.filter((status) => status !== value)
        : [...current, value]
    );
  };

  const applyTicketFilters = () => {
    const nextAssignment = ASSIGNMENT_SCOPE_KEYS.has(draftAssignmentScope)
      ? draftAssignmentScope
      : "all";
    const nextStatuses = normalizeStatusSelection(draftStatuses);

    setAssignmentScope(nextAssignment);
    setSelectedStatuses(nextStatuses);
    setPage(1);
    setSelectedTicket(null);
    setFilterPanelOpen(false);

    const next = new URLSearchParams(searchParams);
    next.delete("view");
    next.delete("status");
    if (nextAssignment === "all") next.delete("assignment");
    else next.set("assignment", nextAssignment);
    if (nextStatuses.length) next.set("statuses", nextStatuses.join(","));
    else next.delete("statuses");
    next.delete("page");
    setSearchParams(next, { replace: true });
  };

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
$front = Replace-Once $front $oldHandlers $newHandlers "unified filter handlers"

# Remove the permanent status pill row completely.
$statusPills = @'
          <div className="scrollbar-thin flex shrink-0 gap-2 overflow-x-auto border-b border-slate-200 px-3 py-2.5 [scrollbar-width:thin] xl:px-4 xl:py-3">
            {STATUS_TABS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => changeFilter(status)}
                className={classNames(
                  "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-bold xl:px-3.5",
                  statusFilter === status
                    ? "bg-[#172b57] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {status}
                <span
                  className={classNames(
                    "ml-2 rounded-full px-2 py-0.5 text-xs",
                    statusFilter === status
                      ? "bg-white/20 text-white"
                      : "bg-white text-slate-500"
                  )}
                >
                  {statusCount(status)}
                </span>
              </button>
            ))}
          </div>
'@
$front = Replace-Once $front $statusPills '' "permanent status pills"

# Update compact closed-state summary and initialize both drafts when opening.
$front = Replace-Once $front @'
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Assignment scope
                </p>
                <p className="truncate text-sm font-semibold text-slate-800">
                  {activeAssignmentLabel}
                </p>
              </div>
'@ @'
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Active filters
                </p>
                <p className="truncate text-sm font-semibold text-slate-800">
                  {activeStatusLabel} · {activeAssignmentLabel}
                </p>
              </div>
'@ "compact active summary"

$front = Replace-Once $front @'
                  onClick={() => {
                    setDraftAssignmentScope(assignmentScope);
                    setFilterPanelOpen((current) => !current);
                  }}
'@ @'
                  onClick={() => {
                    setDraftAssignmentScope(assignmentScope);
                    setDraftStatuses(selectedStatuses);
                    setFilterPanelOpen((current) => !current);
                  }}
'@ "filter open drafts"

$front = Replace-Once $front @'
                        <p className="mt-1 text-sm text-slate-500">
                          Choose which assignment queue to display.
                        </p>
'@ @'
                        <p className="mt-1 text-sm text-slate-500">
                          Combine compatible statuses with one assignment scope.
                        </p>
'@ "filter panel description"

# Insert status presets and status checkboxes before assignment scope.
$assignmentHeading = @'
                    <div className="space-y-2 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Assignment scope
                      </p>
'@
$unifiedPanel = @'
                    <div className="max-h-[65vh] space-y-5 overflow-y-auto p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Ticket status
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setDraftStatuses([])}
                              className={classNames(
                                "rounded-lg border px-2.5 py-1 text-xs font-bold",
                                !draftStatuses.length
                                  ? "border-[#172b57] bg-[#172b57] text-white"
                                  : "border-slate-200 bg-white text-slate-600"
                              )}
                            >
                              All
                            </button>
                            <button
                              type="button"
                              onClick={() => setDraftStatuses([...UNRESOLVED_STATUSES])}
                              className={classNames(
                                "rounded-lg border px-2.5 py-1 text-xs font-bold",
                                sameStatuses(draftStatuses, UNRESOLVED_STATUSES)
                                  ? "border-[#172b57] bg-[#172b57] text-white"
                                  : "border-slate-200 bg-white text-slate-600"
                              )}
                            >
                              Unresolved
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          {STATUS_OPTIONS.map((status) => {
                            const selected = draftStatuses.includes(status);
                            return (
                              <button
                                key={status}
                                type="button"
                                role="checkbox"
                                aria-checked={selected}
                                onClick={() => toggleDraftStatus(status)}
                                className={classNames(
                                  "flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition",
                                  selected
                                    ? "border-[#172b57] bg-[#172b57]/5"
                                    : "border-slate-200 hover:bg-slate-50"
                                )}
                              >
                                <span className="flex min-w-0 items-center gap-3">
                                  <span
                                    className={classNames(
                                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                                      selected
                                        ? "border-[#172b57] bg-[#172b57] text-white"
                                        : "border-slate-300 text-transparent"
                                    )}
                                  >
                                    <Check className="h-3 w-3" />
                                  </span>
                                  <span className="truncate text-sm font-bold text-slate-900">
                                    {status}
                                  </span>
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                                  {statusCount(status)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-slate-200 pt-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Assignment scope
                        </p>
'@
$front = Replace-Once $front $assignmentHeading $unifiedPanel "unified panel status section"

# Close added assignment wrapper before original panel content wrapper.
$front = Replace-Once $front @'
                      ))}
                    </div>

                    <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-4">
'@ @'
                      ))}
                      </div>
                    </div>

                    <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-4">
'@ "assignment wrapper closing"

$front = Replace-Once $front @'
                        onClick={clearAssignmentFilter}
                        disabled={assignmentScope === "all"}
'@ @'
                        onClick={clearAllTicketFilters}
                        disabled={
                          assignmentScope === "all" &&
                          !selectedStatuses.length &&
                          !appliedQuery
                        }
'@ "clear all panel button"

$front = Replace-Once $front @'
                        onClick={() => applyAssignmentScope(draftAssignmentScope)}
'@ @'
                        onClick={applyTicketFilters}
'@ "apply unified filters"

$front = Replace-Once $front '> Clear' '> Clear all' "clear button label"
$front = Replace-Once $front 'Apply filter' 'Apply filters' "apply button label"

Write-Utf8 $ticketsPath $backend
Write-Utf8 $workspacePath $front
if(Test-Path $allowedReport){Remove-Item $allowedReport -Force}

node --check $ticketsPath
if($LASTEXITCODE -ne 0){throw "Backend syntax failed after integration."}
Write-Host "Unified multi-select Ticket Workspace filters integrated." -ForegroundColor Green
Write-Host "Statuses are multi-select; assignment scope remains single-select." -ForegroundColor Cyan
Write-Host "Run scripts/45-validate-unified-multiselect-ticket-filters.ps1 next." -ForegroundColor Cyan
