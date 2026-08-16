param(
    [string]$RepositoryRoot = ""
)

$ErrorActionPreference = "Stop"

function Resolve-RepositoryRoot {
    param([string]$RequestedRoot)

    if ($RequestedRoot) {
        return (Resolve-Path $RequestedRoot).Path
    }

    $current = (Get-Location).Path

    if (Test-Path (Join-Path $current "backend/src/services/emailTicketIntake.js")) {
        return $current
    }

    if (
        (Split-Path $current -Leaf) -eq "backend" -and
        (Test-Path (Join-Path $current "src/services/emailTicketIntake.js"))
    ) {
        return (Resolve-Path (Join-Path $current "..")).Path
    }

    throw "Run this script from the repository root or backend directory."
}

$root = Resolve-RepositoryRoot -RequestedRoot $RepositoryRoot
Set-Location $root

$expectedBranch = "feature/resgo-ticket-trail-catalogue-integration"
$currentBranch = (git branch --show-current).Trim()

if ($currentBranch -ne $expectedBranch) {
    throw "Expected branch $expectedBranch but found $currentBranch."
}

$backend = Join-Path $root "backend"
$envPath = Join-Path $backend ".env"
$servicePath = Join-Path $backend "src/services/emailTicketIntake.js"
$excludePath = Join-Path $root ".git/info/exclude"

if (-not (Test-Path $envPath)) {
    throw "Missing backend environment file: $envPath"
}

if (-not (Test-Path $servicePath)) {
    throw "Missing email intake service: $servicePath"
}

$enabledLine = Select-String -Path $envPath -Pattern '^EMAIL_TO_TICKET_ENABLED=' | Select-Object -First 1
if (-not $enabledLine) {
    throw "EMAIL_TO_TICKET_ENABLED is not configured in backend/.env."
}

if ($enabledLine.Line.Trim().ToLowerInvariant() -ne "email_to_ticket_enabled=false") {
    throw "Stop: EMAIL_TO_TICKET_ENABLED must remain false during hardening."
}

Write-Host "Confirmed: automatic email intake is disabled." -ForegroundColor Green

$working = Join-Path $backend ".email-intake-hardening"
New-Item -ItemType Directory -Path $working -Force | Out-Null

$inspectScript = @'
require("dotenv").config();
const pool = require("../src/db/pool");

async function run() {
  const result = await pool.query(`
    SELECT
      e.id AS intake_id,
      e.received_at,
      e.sender_email,
      e.subject,
      e.status AS intake_status,
      e.classification,
      e.confidence,
      e.error_message,
      t.id AS ticket_id,
      t.ticket_ref,
      t.title,
      t.ticket_type,
      t.status AS ticket_status,
      t.assigned_group_id,
      t.created_at
    FROM email_ticket_intake e
    LEFT JOIN tickets t ON t.id = e.ticket_id
    ORDER BY e.id DESC
    LIMIT 100
  `);

  console.table(result.rows);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
'@

$exportScript = @'
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("../src/db/pool");

function csvValue(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

async function run() {
  const result = await pool.query(`
    SELECT
      e.*,
      t.ticket_ref,
      t.title AS ticket_title,
      t.ticket_type,
      t.status AS ticket_status
    FROM email_ticket_intake e
    LEFT JOIN tickets t ON t.id = e.ticket_id
    ORDER BY e.id
  `);

  if (!result.rows.length) {
    console.log("No intake records found.");
    return;
  }

  const columns = Object.keys(result.rows[0]);
  const lines = [
    columns.map(csvValue).join(","),
    ...result.rows.map((row) =>
      columns.map((column) => csvValue(row[column])).join(",")
    ),
  ];

  const output = path.join(__dirname, "email-intake-before-hardening.csv");
  fs.writeFileSync(output, lines.join("\n"), "utf8");
  console.log(`Exported ${result.rows.length} records to ${output}`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
'@

$relationshipsScript = @'
require("dotenv").config();
const pool = require("../src/db/pool");

async function run() {
  const result = await pool.query(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS referenced_table,
      ccu.column_name AS referenced_column,
      rc.delete_rule,
      rc.update_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
     AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'tickets'
    ORDER BY tc.table_name, kcu.column_name
  `);

  console.table(result.rows);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
'@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$inspectPath = Join-Path $working "inspect-email-intake.js"
$exportPath = Join-Path $working "export-email-intake.js"
$relationshipsPath = Join-Path $working "inspect-ticket-relationships.js"

[System.IO.File]::WriteAllText($inspectPath, $inspectScript, $utf8NoBom)
[System.IO.File]::WriteAllText($exportPath, $exportScript, $utf8NoBom)
[System.IO.File]::WriteAllText($relationshipsPath, $relationshipsScript, $utf8NoBom)

Push-Location $backend
try {
    node --check ".email-intake-hardening/inspect-email-intake.js"
    if ($LASTEXITCODE -ne 0) { throw "Inspection script syntax failed." }

    node --check ".email-intake-hardening/export-email-intake.js"
    if ($LASTEXITCODE -ne 0) { throw "Export script syntax failed." }

    node --check ".email-intake-hardening/inspect-ticket-relationships.js"
    if ($LASTEXITCODE -ne 0) { throw "Relationship script syntax failed." }

    Write-Host "`n=== EMAIL INTAKE RECORDS ===" -ForegroundColor Cyan
    node ".email-intake-hardening/inspect-email-intake.js"
    if ($LASTEXITCODE -ne 0) { throw "Email intake inspection failed." }

    Write-Host "`n=== EXPORT ===" -ForegroundColor Cyan
    node ".email-intake-hardening/export-email-intake.js"
    if ($LASTEXITCODE -ne 0) { throw "Email intake export failed." }

    Write-Host "`n=== TICKET FOREIGN-KEY RELATIONSHIPS ===" -ForegroundColor Cyan
    node ".email-intake-hardening/inspect-ticket-relationships.js"
    if ($LASTEXITCODE -ne 0) { throw "Ticket relationship inspection failed." }
}
finally {
    Pop-Location
}

$reportPath = Join-Path $root "email-intake-hardening-preflight.txt"
$patterns = @(
    "function config",
    "EMAIL_TO_TICKET",
    "receivedDateTime",
    "isRead",
    "mailFolders",
    "messages",
    "orderby",
    "pageSize",
    "send",
    "acknowledge",
    "JSON.parse",
    "response.json",
    "response.text",
    "mark",
    "sender",
    "subject",
    "Automatic reply",
    "noreply",
    "postmaster",
    "runEmailIntake"
)

$report = [System.Collections.Generic.List[string]]::new()
$report.Add("EMAIL INTAKE HARDENING PREFLIGHT")
$report.Add("Generated: $(Get-Date -Format o)")
$report.Add("Branch: $currentBranch")
$report.Add("")

foreach ($pattern in $patterns) {
    $report.Add(("=" * 78))
    $report.Add("PATTERN: $pattern")
    $report.Add(("=" * 78))

    $matches = Select-String -Path $servicePath -SimpleMatch $pattern -Context 5,12
    if ($matches) {
        $report.Add(($matches | Out-String))
    }
    else {
        $report.Add("No matches.")
    }
}

[System.IO.File]::WriteAllLines($reportPath, $report, $utf8NoBom)

$excludeEntries = @(
    "backend/.email-intake-hardening/",
    "email-intake-hardening-preflight.txt"
)

foreach ($entry in $excludeEntries) {
    $exists = Select-String -Path $excludePath -SimpleMatch $entry -Quiet -ErrorAction SilentlyContinue
    if (-not $exists) {
        Add-Content -Path $excludePath -Value $entry
    }
}

$csvPath = Join-Path $working "email-intake-before-hardening.csv"
if (-not (Test-Path $csvPath)) {
    throw "Expected CSV export was not created: $csvPath"
}

if (-not (Test-Path $reportPath)) {
    throw "Expected hardening preflight report was not created: $reportPath"
}

Write-Host "`nEmail intake hardening preflight completed." -ForegroundColor Green
Write-Host "CSV export: $csvPath" -ForegroundColor Cyan
Write-Host "Source report: $reportPath" -ForegroundColor Cyan
Write-Host "No application source files were changed." -ForegroundColor Green
Write-Host "Do not run email intake again until hardening is implemented." -ForegroundColor Yellow
