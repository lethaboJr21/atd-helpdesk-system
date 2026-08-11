param([string]$RepositoryRoot = (Get-Location).Path)

$ErrorActionPreference = "Stop"
Set-Location $RepositoryRoot

$expectedBranch = "feature/resgo-ticket-trail-catalogue-integration"
$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $expectedBranch) {
  throw "Expected branch $expectedBranch but found $currentBranch."
}

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
  throw "Working tree contains unexpected changes."
}

$backendPath = "backend/src/routes/tickets.js"
$workspacePath = "frontend/src/pages/TicketWorkspace.jsx"
foreach ($path in @($backendPath,$workspacePath)) {
  if (-not (Test-Path $path)) { throw "Missing source file: $path" }
}

$backupRoot = Join-Path $RepositoryRoot ".git/ticket-workspace-agent-filters-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
foreach ($path in @($backendPath,$workspacePath)) {
  $target = Join-Path $backupRoot $path
  New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
  Copy-Item $path $target -Force
}
Write-Host "Backup created: $backupRoot" -ForegroundColor Cyan

$encoding = New-Object System.Text.UTF8Encoding($false)
function Read-Text([string]$Path) {
  [System.IO.File]::ReadAllText((Resolve-Path $Path).Path)
}
function Write-Text([string]$Path,[string]$Text) {
  [System.IO.File]::WriteAllText((Resolve-Path $Path).Path,$Text,$encoding)
}
function Replace-Once([string]$Text,[string]$Pattern,[string]$Replacement,[string]$Label) {
  $rx = [regex]::new($Pattern,[System.Text.RegularExpressions.RegexOptions]::Multiline)
  $count = $rx.Matches($Text).Count
  if ($count -ne 1) { throw "$Label expected exactly one match; found $count." }
  $rx.Replace($Text,$Replacement,1)
}
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

# -----------------------------------------------------------------------------
# Backend: authenticated-only symbolic assignment filters.
# -----------------------------------------------------------------------------
$backend = Read-Text $backendPath
if ($backend.Contains('const allowedAssignmentScopes=new Set(["all","mine","unassigned","my-groups"])')) {
  throw "Backend assignment filters already appear to be installed."
}

$newScope = @'
  const legacyView=String(req.query.view||"").toLowerCase();
  const assignmentScope=String(
    req.query.assignmentScope||req.query.assignee||req.query.scope||(legacyView==="mine"?"mine":"all")
  ).trim().toLowerCase();
  const allowedAssignmentScopes=new Set(["all","mine","unassigned","my-groups"]);
  if(!allowedAssignmentScopes.has(assignmentScope)){
    return res.status(400).json({error:"Invalid assignment filter."});
  }
  if(assignmentScope!=="all"&&!operations(req.user)){
    return res.status(403).json({error:"Assignment filters are available to Helpdesk operations users only."});
  }
  if(assignmentScope==="mine"){
    add("t.assigned_to_user_id=?",req.user.id);
  }else if(assignmentScope==="unassigned"){
    conditions.push("t.assigned_to_user_id IS NULL");
  }else if(assignmentScope==="my-groups"){
    values.push(req.user.id);
    const i=values.length;
    conditions.push(`t.assigned_group_id IN(
      SELECT gm.group_id
      FROM support_group_members gm
      JOIN support_groups sg ON sg.id=gm.group_id AND COALESCE(sg.is_active,TRUE)=TRUE
      WHERE gm.user_id=$${i}
    )`);
  }
'@
$legacyPattern = '(?ms)^\s*if\s*\(\s*String\s*\(\s*req\.query\.view\s*\|\|\s*""\s*\)\s*\.toLowerCase\(\)\s*===\s*"mine"\s*\)\s*\{\s*add\s*\(\s*"t\.assigned_to_user_id=\?"\s*,\s*req\.user\.id\s*\)\s*;?\s*\}'
$legacyRegex = New-Object System.Text.RegularExpressions.Regex($legacyPattern)
$legacyCount = $legacyRegex.Matches($backend).Count
if ($legacyCount -ne 1) {
  throw "Backend legacy mine-filter expected exactly one match; found $legacyCount."
}
$backend = $legacyRegex.Replace($backend,$newScope,1)

# -----------------------------------------------------------------------------
# Frontend: assignment scope + URL ownership for status/search/page.
# -----------------------------------------------------------------------------
$workspace = Read-Text $workspacePath
if ($workspace.Contains("const ASSIGNMENT_SCOPES = [")) {
  throw "Frontend assignment filters already appear to be installed."
}

$workspace = Replace-Literal-Once $workspace 'const PAGE_SIZE = 30;' @'
const PAGE_SIZE = 30;
const ASSIGNMENT_SCOPES = [
  { key: "all", label: "All Tickets" },
  { key: "mine", label: "Assigned to Me" },
  { key: "unassigned", label: "Unassigned" },
  { key: "my-groups", label: "My Support Groups" },
];
const ASSIGNMENT_SCOPE_KEYS = new Set(
  ASSIGNMENT_SCOPES.map((item) => item.key)
);
'@ "PAGE_SIZE constant"

$workspace = Replace-Literal-Once $workspace @'
  const defaultStatus =
    searchParams.get("status") || (employeeExperience ? "All" : "Unresolved");
'@ @'
  const defaultStatus =
    searchParams.get("status") || (employeeExperience ? "All" : "Unresolved");
  const requestedAssignmentScope =
    searchParams.get("assignment") ||
    (searchParams.get("view") === "mine" ? "mine" : "all");
  const defaultAssignmentScope = ASSIGNMENT_SCOPE_KEYS.has(
    requestedAssignmentScope
  )
    ? requestedAssignmentScope
    : "all";
  const defaultPage = Math.max(Number(searchParams.get("page")) || 1, 1);
  const defaultQuery = searchParams.get("search") || "";
'@ "URL defaults"

$workspace = Replace-Literal-Once $workspace '  const [query, setQuery] = useState("");' @'
  const [query, setQuery] = useState(defaultQuery);
  const [assignmentScope, setAssignmentScope] = useState(
    defaultAssignmentScope
  );
'@ "query state"
$workspace = Replace-Literal-Once $workspace '  const [page, setPage] = useState(1);' '  const [page, setPage] = useState(defaultPage);' "page state"
$workspace = Replace-Literal-Once $workspace '  const [appliedQuery, setAppliedQuery] = useState("");' '  const [appliedQuery, setAppliedQuery] = useState(defaultQuery.trim());' "applied query state"

$workspace = Replace-Literal-Once $workspace @'
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedQuery(query.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);
'@ @'
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
'@ "search persistence effect"

$workspace = Replace-Literal-Once $workspace @'
        ...(appliedQuery ? { search: appliedQuery } : {}),
        ...(searchParams.get("view") === "mine" ? { view: "mine" } : {}),
'@ @'
        ...(appliedQuery ? { search: appliedQuery } : {}),
        ...(assignmentScope !== "all" ? { assignmentScope } : {}),
'@ "ticket API assignment payload"

$workspace = Replace-Literal-Once $workspace '  }, [appliedQuery, employeeExperience, page, searchParams, statusFilter]);' '  }, [appliedQuery, assignmentScope, employeeExperience, page, statusFilter]);' "fetch dependency list"

$workspace = Replace-Literal-Once $workspace @'
    if (value === "All") next.delete("status");
    else next.set("status", value);
    setSearchParams(next, { replace: true });
'@ @'
    if (value === "All") next.delete("status");
    else next.set("status", value);
    next.delete("page");
    setSearchParams(next, { replace: true });
'@ "status URL persistence"

$handlers = @'

  const changeAssignmentScope = (value) => {
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
  };

  const changePage = (nextPage) => {
    const safePage = Math.max(Number(nextPage) || 1, 1);
    setPage(safePage);
    setSelectedTicket(null);
    const next = new URLSearchParams(searchParams);
    if (safePage === 1) next.delete("page");
    else next.set("page", String(safePage));
    setSearchParams(next, { replace: true });
  };
'@
$workspace = Replace-Literal-Once $workspace '  const runAction = async (action, message) => {' ($handlers + "`n`n" + '  const runAction = async (action, message) => {') "filter handlers anchor"

$paginationOld = @'
                onPageChange={(nextPage) => {
                  setPage(nextPage);
                  setSelectedTicket(null);
                }}
'@
$paginationCount = ([regex]::Matches($workspace,[regex]::Escape($paginationOld))).Count
if ($paginationCount -ne 2) {
  throw "Expected two pagination handlers; found $paginationCount."
}
$workspace = $workspace.Replace($paginationOld,'                onPageChange={changePage}' + "`n")

$assignmentUi = @'

          {!employeeExperience ? (
            <div className="scrollbar-thin flex shrink-0 items-center gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50/70 px-3 py-2.5 [scrollbar-width:thin] xl:px-4">
              <span className="mr-1 whitespace-nowrap text-xs font-bold uppercase tracking-wide text-slate-500">
                Assignment
              </span>
              {ASSIGNMENT_SCOPES.map((scope) => (
                <button
                  key={scope.key}
                  type="button"
                  onClick={() => changeAssignmentScope(scope.key)}
                  className={classNames(
                    "whitespace-nowrap rounded-xl border px-3 py-1.5 text-sm font-bold transition",
                    assignmentScope === scope.key
                      ? "border-[#172b57] bg-[#172b57] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {scope.label}
                </button>
              ))}
            </div>
          ) : null}
'@
$uiAnchor = @'
          </div>

          {!employeeExperience ? (
            <div className="shrink-0">
              <PaginationBar
'@
$uiReplacement = '          </div>' + $assignmentUi + @'

          {!employeeExperience ? (
            <div className="shrink-0">
              <PaginationBar
'@
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

# Fix formatting left by the prior five-entry integration without changing behavior.
$workspace = $workspace.Replace('      />    </OperationsShell>','      />' + "`n" + '    </OperationsShell>')

# Write only after every anchor has succeeded.
Write-Text $backendPath $backend
Write-Text $workspacePath $workspace

foreach ($report in $allowedReports) {
  if (Test-Path $report) { Remove-Item $report -Force }
}

$markers = Get-ChildItem backend/src,frontend/src -Recurse -File | Select-String -Pattern '^(<<<<<<<|=======|>>>>>>>)'
if ($markers) { $markers; throw "Conflict markers detected after integration." }

Write-Host "Ticket Workspace assignment filters integrated." -ForegroundColor Green
Write-Host "Added: Assigned to Me, Unassigned, My Support Groups and URL persistence." -ForegroundColor Cyan
Write-Host "Run scripts/33-validate-ticket-workspace-agent-filters.ps1 next." -ForegroundColor Cyan
