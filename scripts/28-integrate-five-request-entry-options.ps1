param(
  [string]$RepositoryRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
Set-Location $RepositoryRoot

$expectedBranch = "feature/resgo-ticket-trail-catalogue-integration"
$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $expectedBranch) { throw "Expected branch $expectedBranch but found $currentBranch." }

$unexpected = @(git status --porcelain | Where-Object { $_ -notmatch '^\?\? five-request-entry-preflight\.txt$' })
if ($unexpected.Count -gt 0) { $unexpected | Write-Host; throw "Working tree contains unexpected changes." }

$paths = @{
  Workspace = "frontend/src/pages/TicketWorkspace.jsx"
  Modules   = "frontend/src/data/requestModules.js"
  App       = "frontend/src/App.jsx"
  Create    = "frontend/src/pages/TicketCreatePage.jsx"
  Tickets   = "backend/src/routes/tickets.js"
  Menu      = "frontend/src/components/tickets/RequestEntryMenu.jsx"
}
foreach ($path in $paths.Values) {
  if ($path -ne $paths.Menu -and -not (Test-Path $path)) { throw "Required file missing: $path" }
}

$backupRoot = Join-Path $RepositoryRoot ".git/five-request-entry-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
foreach ($path in $paths.Values) {
  if (Test-Path $path) {
    $target = Join-Path $backupRoot $path
    New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
    Copy-Item $path $target -Force
  }
}
Write-Host "Backup created: $backupRoot" -ForegroundColor Cyan

$encoding = New-Object System.Text.UTF8Encoding($false)
function Read-Text([string]$Path) { [System.IO.File]::ReadAllText((Resolve-Path $Path).Path) }
function Write-Text([string]$Path,[string]$Text) {
  $full = if (Test-Path $Path) { (Resolve-Path $Path).Path } else { Join-Path $RepositoryRoot $Path }
  $dir = Split-Path $full
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  [System.IO.File]::WriteAllText($full,$Text,$encoding)
}
function Replace-Once([string]$Text,[string]$Pattern,[string]$Replacement,[string]$Label) {
  $rx = [regex]::new($Pattern,[System.Text.RegularExpressions.RegexOptions]::Multiline)
  $matches = $rx.Matches($Text)
  if ($matches.Count -ne 1) { throw "$Label expected exactly one match; found $($matches.Count)." }
  $rx.Replace($Text,$Replacement,1)
}
function Insert-Before-Last([string]$Text,[string]$Needle,[string]$Insertion,[string]$Label) {
  $index = $Text.LastIndexOf($Needle,[System.StringComparison]::Ordinal)
  if ($index -lt 0) { throw "$Label anchor not found." }
  $Text.Insert($index,$Insertion)
}

# 1. New five-choice modal.
$menu = @'
import {
  BriefcaseBusiness,
  FolderKanban,
  LifeBuoy,
  PackagePlus,
  Plus,
  ShoppingCart,
  X,
} from "lucide-react";
import { useEffect } from "react";

const REQUEST_ENTRIES = [
  {
    key: "incident",
    title: "Report an Incident",
    description: "Report a fault, outage, error or service that is not working correctly.",
    path: "/incidents/new",
    icon: LifeBuoy,
    iconClass: "bg-rose-100 text-rose-700",
  },
  {
    key: "service",
    title: "Request a Service",
    description: "Request access, software, support or another standard company service.",
    path: "/services",
    icon: ShoppingCart,
    iconClass: "bg-blue-100 text-blue-700",
  },
  {
    key: "change",
    title: "Change Management",
    description: "Plan and submit an application, infrastructure or configuration change.",
    path: "/changes/new",
    icon: BriefcaseBusiness,
    iconClass: "bg-amber-100 text-amber-700",
  },
  {
    key: "asset",
    title: "Request an Asset",
    description: "Request equipment, devices, accessories, replacements or temporary assets.",
    path: "/request-asset",
    icon: PackagePlus,
    iconClass: "bg-emerald-100 text-emerald-700",
  },
  {
    key: "project",
    title: "Create a Project",
    description: "Initiate a structured project with ownership, objectives and target dates.",
    path: "/projects/new",
    icon: FolderKanban,
    iconClass: "bg-purple-100 text-purple-700",
  },
];

export default function RequestEntryMenu({ open, onClose, onSelect }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 py-10 backdrop-blur-sm sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-entry-title"
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-200 p-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
              <Plus className="h-3.5 w-3.5" /> New request
            </div>
            <h2 id="request-entry-title" className="text-2xl font-bold text-slate-950">
              What would you like to create?
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Select the request type. The Helpdesk opens the correct catalogue or form immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close request type selector"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="grid gap-4 p-6 md:grid-cols-2">
          {REQUEST_ENTRIES.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => onSelect(entry)}
                className="group flex min-h-36 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"
              >
                <span className={`rounded-2xl p-3 ${entry.iconClass}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <span>
                  <span className="block text-base font-bold text-slate-950 group-hover:text-blue-800">
                    {entry.title}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-slate-600">
                    {entry.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
'@
Write-Text $paths.Menu $menu

# 2. Add Project request module.
$modules = Read-Text $paths.Modules
if ($modules -match 'ticketType:\s*"project"') { throw "Project module already exists." }
$modules = Replace-Once $modules '(?m)^\s{2}ClipboardCheck,\r?$' "  ClipboardCheck,`n  FolderKanban," "FolderKanban import"
$projectModule = @'
  project: {
    key: "project",
    ticketType: "project",
    label: "Create a Project",
    shortLabel: "Project",
    description: "Initiate a structured project with objectives, ownership, dates and deliverables.",
    path: "/projects/new",
    catalogPath: null,
    workspace: "Project Management",
    icon: FolderKanban,
    tone: "purple",
    submitLabel: "Create Project",
  },
'@
$modules = Replace-Once $modules '(?m)^(\s{2}change:\s*\{[\s\S]*?^\s{2}\},\r?\n)(\};)' ('$1' + $projectModule + '$2') "Project module insertion"
Write-Text $paths.Modules $modules

# 3. Add Project route.
$app = Read-Text $paths.App
if ($app -match 'path="/projects/new"') { throw "Project route already exists." }
$projectRoute = @'

      <Route
        path="/projects/new"
        element={
          <PrivateRoute>
            <TicketCreatePage lockedType="project" />
          </PrivateRoute>
        }
      />
'@
$app = Replace-Once $app '(?m)(\s*<Route\r?\n\s*path="/changes/new"[\s\S]*?\s*/>)(\r?\n\r?\n\s*<Route\r?\n\s*path="/tickets/:id")' ('$1' + $projectRoute + '$2') "Project route insertion"
Write-Text $paths.App $app

# 4. Connect modal to Ticket Workspace.
$workspace = Read-Text $paths.Workspace
if ($workspace -match 'RequestEntryMenu') { throw "RequestEntryMenu is already connected." }
$workspace = Replace-Once $workspace '(?m)^(import OperationsShell from "\.\./components/OperationsShell";\r?$)' ('$1' + "`n" + 'import RequestEntryMenu from "../components/tickets/RequestEntryMenu";') "Workspace menu import"
$workspace = Replace-Once $workspace '(?m)^(\s*const \[groupsError, setGroupsError\] = useState\([^\r\n]*\);\r?$)' ('$1' + "`n" + '  const [requestEntryOpen, setRequestEntryOpen] = useState(false);') "Workspace menu state"
$workspace = Replace-Once $workspace 'onClick=\{\(\) => navigate\("/incidents/new"\)\}([\s\S]*?<Plus className="h-4 w-4" />\s*)Report Incident' 'onClick={() => setRequestEntryOpen(true)}$1Create Request' "Workspace create button"
$menuUsage = @'

      <RequestEntryMenu
        open={requestEntryOpen}
        onClose={() => setRequestEntryOpen(false)}
        onSelect={(entry) => {
          setRequestEntryOpen(false);
          navigate(entry.path);
        }}
      />
'@
$workspace = Insert-Before-Last $workspace "    </OperationsShell>" $menuUsage "OperationsShell closing"
Write-Text $paths.Workspace $workspace

# 5. Add Project form fields and request details.
$create = Read-Text $paths.Create
if ($create -match 'projectObjective') { throw "Project fields already exist." }
$create = Replace-Once $create '(?m)^(\s{4}backoutPlan:\s*"",\r?$)' ('$1' + "`n" + @'
    // Project
    projectObjective: "",
    projectSponsor: "",
    projectOwner: "",
    projectStart: "",
    projectEnd: "",
    projectScope: "",
    projectDeliverables: "",
'@) "Project form state"
$projectDetails = @'

    if (ticketType === "project") {
      details.module = "project";
      details.objective = form.projectObjective.trim();
      details.sponsor = form.projectSponsor.trim();
      details.owner = form.projectOwner.trim();
      details.proposedStart = form.projectStart || null;
      details.targetCompletion = form.projectEnd || null;
      details.scope = form.projectScope.trim();
      details.deliverables = form.projectDeliverables.trim();
    }
'@
$create = Replace-Once $create '(?m)^(\s{4}return details;\r?$)' ($projectDetails + "`n" + '$1') "Project request details"
$projectValidation = @'

    if (ticketType === "project") {
      if (!form.projectObjective.trim()) return setError("A business objective is required.");
      if (!form.projectSponsor.trim()) return setError("A project sponsor is required.");
      if (!form.projectOwner.trim()) return setError("A project owner is required.");
      if (!form.projectStart || !form.projectEnd) return setError("Project start and target completion dates are required.");
      if (new Date(form.projectEnd) < new Date(form.projectStart)) return setError("Target completion must be after the project start date.");
      if (!form.projectScope.trim()) return setError("Project scope is required.");
      if (!form.projectDeliverables.trim()) return setError("Project deliverables are required.");
    }
'@
$create = Replace-Once $create '(?m)^(\s{4}setSubmitting\(true\);\r?$)' ($projectValidation + "`n" + '$1') "Project validation"
$create = Replace-Once $create '(?m)^\s{14}: form\.category \|\| "Change";\r?$' @'
              : ticketType === "project"
                ? "Project Management"
                : form.category || "Change";
'@ "Project category"
$create = Replace-Once $create '(?m)^\s{14}: form\.changeType \|\| null;\r?$' @'
              : ticketType === "project"
                ? form.projectObjective || null
                : form.changeType || null;
'@ "Project subcategory"
$projectFields = @'

            {ticketType === "project" ? (
              <div className="space-y-4 rounded-2xl border border-purple-200 bg-purple-50/40 p-4">
                <div>
                  <h3 className="font-bold text-slate-900">Project initiation</h3>
                  <p className="mt-1 text-sm text-slate-600">Define the business outcome, ownership, schedule, scope and deliverables.</p>
                </div>
                <Field label="Business Objective">
                  <textarea rows="3" value={form.projectObjective} onChange={(event) => update("projectObjective", event.target.value)} className="input" required placeholder="What business outcome should this project achieve?" />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Project Sponsor">
                    <input value={form.projectSponsor} onChange={(event) => update("projectSponsor", event.target.value)} className="input" required placeholder="Executive or business sponsor" />
                  </Field>
                  <Field label="Project Owner">
                    <input value={form.projectOwner} onChange={(event) => update("projectOwner", event.target.value)} className="input" required placeholder="Accountable project owner" />
                  </Field>
                  <Field label="Proposed Start Date">
                    <input type="date" value={form.projectStart} onChange={(event) => update("projectStart", event.target.value)} className="input" required />
                  </Field>
                  <Field label="Target Completion Date">
                    <input type="date" min={form.projectStart || undefined} value={form.projectEnd} onChange={(event) => update("projectEnd", event.target.value)} className="input" required />
                  </Field>
                </div>
                <Field label="Project Scope">
                  <textarea rows="4" value={form.projectScope} onChange={(event) => update("projectScope", event.target.value)} className="input" required placeholder="What is included and excluded from the project?" />
                </Field>
                <Field label="Deliverables">
                  <textarea rows="4" value={form.projectDeliverables} onChange={(event) => update("projectDeliverables", event.target.value)} className="input" required placeholder="List the expected outputs and acceptance outcomes." />
                </Field>
              </div>
            ) : null}
'@
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
$create = Replace-Once $create '(?m)^(\s{6}backoutPlan:\s*"",\r?$)' ('$1' + "`n" + @'
      projectObjective: "",
      projectSponsor: "",
      projectOwner: "",
      projectStart: "",
      projectEnd: "",
      projectScope: "",
      projectDeliverables: "",
'@) "Project reset state"
Write-Text $paths.Create $create

# 6. Give Projects their own ticket reference prefix.
$tickets = Read-Text $paths.Tickets
if ($tickets -match 'project\s*:\s*"PRJ"') { throw "Project prefix already exists." }
$tickets = Replace-Once $tickets '(?m)^const TYPE_PREFIX = \{ incident:"INC", request:"REQ", service_request:"REQ", asset_request:"REQ", change:"CHG" \};\r?$' 'const TYPE_PREFIX = { incident:"INC", request:"REQ", service_request:"REQ", asset_request:"REQ", change:"CHG", project:"PRJ" };' "Project ticket prefix"
Write-Text $paths.Tickets $tickets

# 7. Final source checks before returning control.
$checks = @(
  @{ Path=$paths.Menu; Text='title: "Create a Project"' },
  @{ Path=$paths.Workspace; Text='Create Request' },
  @{ Path=$paths.Modules; Text='ticketType: "project"' },
  @{ Path=$paths.App; Text='path="/projects/new"' },
  @{ Path=$paths.Create; Text='projectObjective' },
  @{ Path=$paths.Tickets; Text='project:"PRJ"' }
)
foreach ($check in $checks) {
  if (-not (Read-Text $check.Path).Contains($check.Text)) { throw "Post-write check failed: $($check.Path) missing $($check.Text)" }
}

$markers = Get-ChildItem backend/src,frontend/src -Recurse -File | Select-String -Pattern '^(<<<<<<<|=======|>>>>>>>)'
if ($markers) { $markers; throw "Conflict markers detected after integration." }

if (Test-Path "five-request-entry-preflight.txt") { Remove-Item "five-request-entry-preflight.txt" -Force }
Write-Host "Five separate request-entry options integrated." -ForegroundColor Green
Write-Host "Asset Request and Create a Project are separate." -ForegroundColor Green
Write-Host "Run scripts/29-validate-five-request-entry-options.ps1 next." -ForegroundColor Cyan
