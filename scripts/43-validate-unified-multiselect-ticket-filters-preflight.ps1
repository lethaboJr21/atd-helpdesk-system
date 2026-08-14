param([string]$RepositoryRoot = (Get-Location).Path)

$ErrorActionPreference = "Stop"
Set-Location $RepositoryRoot

$report = Join-Path $RepositoryRoot "unified-multiselect-ticket-filters-preflight.txt"
if (-not (Test-Path $report)) { throw "Preflight report is missing: $report" }
if ((Get-Item $report).Length -lt 1800) { throw "Preflight report is unexpectedly small." }

$text = Get-Content $report -Raw
$requiredSections = @(
  "STATUS AND ASSIGNMENT CONSTANTS",
  "FILTER PANEL IMPLEMENTATION",
  "STATUS STATE AND URL PERSISTENCE",
  "CURRENT STATUS PILLS UI",
  "TICKET API PAYLOAD",
  "BACKEND STATUS FILTER SQL",
  "COUNTS AND PAGINATION",
  "EMPTY STATE AND ACTIVE FILTER SUMMARY",
  "AVAILABLE CHECKBOX AND MULTISELECT PATTERNS"
)
foreach ($section in $requiredSections) {
  if (-not $text.Contains($section)) { throw "Preflight report is missing section: $section" }
}

$markers = Select-String -Path @(
  "frontend/src/pages/TicketWorkspace.jsx",
  "backend/src/routes/tickets.js"
) -Pattern '^(<<<<<<<|=======|>>>>>>>)'
if ($markers) { $markers; throw "Conflict markers remain." }

node --check "backend/src/routes/tickets.js"
if ($LASTEXITCODE -ne 0) { throw "Backend ticket route syntax failed." }

Write-Host "Unified multi-select filter preflight validation passed." -ForegroundColor Green
Write-Host "Send unified-multiselect-ticket-filters-preflight.txt for scripts 44 and 45." -ForegroundColor Cyan
