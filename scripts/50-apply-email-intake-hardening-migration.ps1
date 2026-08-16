param([string]$RepositoryRoot = "")

$ErrorActionPreference = "Stop"

function Resolve-RepositoryRoot {
  param([string]$RequestedRoot)

  if ($RequestedRoot) {
    return (Resolve-Path $RequestedRoot).Path
  }

  $current = (Get-Location).Path
  if (Test-Path (Join-Path $current "backend/src/db/pool.js")) {
    return $current
  }

  if (
    (Split-Path $current -Leaf) -eq "backend" -and
    (Test-Path (Join-Path $current "src/db/pool.js"))
  ) {
    return (Resolve-Path (Join-Path $current "..")).Path
  }

  throw "Run this script from the repository root or backend directory."
}

$root = Resolve-RepositoryRoot -RequestedRoot $RepositoryRoot
$backend = Join-Path $root "backend"
$migration = Join-Path $backend "src/db/migrations/2026-08-email-intake-hardening.sql"
$envPath = Join-Path $backend ".env"

if (-not (Test-Path $migration)) {
  throw "Migration is missing: $migration"
}

if (-not (Test-Path $envPath)) {
  throw "Backend environment file is missing: $envPath"
}

$enabled = Select-String -Path $envPath -Pattern '^EMAIL_TO_TICKET_ENABLED=' | Select-Object -First 1
if (-not $enabled -or $enabled.Line.Trim().ToLowerInvariant() -ne "email_to_ticket_enabled=false") {
  throw "EMAIL_TO_TICKET_ENABLED must remain false while applying this migration."
}

$sql = [System.IO.File]::ReadAllText($migration)
if ($sql -match '(?im)\b(DROP|TRUNCATE|DELETE\s+FROM)\b') {
  throw "Destructive SQL was detected. Migration was not run."
}

$tempPath = Join-Path $backend ".apply-email-intake-hardening.js"
$nodeScript = @'
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("./src/db/pool");

async function run() {
  const migrationPath = path.join(
    __dirname,
    "src",
    "db",
    "migrations",
    "2026-08-email-intake-hardening.sql"
  );

  await pool.query(fs.readFileSync(migrationPath, "utf8"));

  const result = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_ticket_intake'
      AND column_name IN (
        'acknowledgement_status',
        'acknowledgement_error',
        'acknowledged_at'
      )
    ORDER BY column_name
  `);

  if (result.rows.length !== 3) {
    throw new Error(
      `Expected 3 acknowledgement columns but found ${result.rows.length}.`
    );
  }

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

$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tempPath, $nodeScript, $utf8)

try {
  Push-Location $backend
  try {
    node --check ".apply-email-intake-hardening.js"
    if ($LASTEXITCODE -ne 0) {
      throw "Temporary migration runner syntax check failed."
    }

    node ".apply-email-intake-hardening.js"
    if ($LASTEXITCODE -ne 0) {
      throw "Email intake hardening migration failed."
    }
  }
  finally {
    Pop-Location
  }
}
finally {
  Remove-Item $tempPath -Force -ErrorAction SilentlyContinue
}

Write-Host "Email intake hardening migration applied successfully." -ForegroundColor Green
Write-Host "Automatic email intake remains disabled." -ForegroundColor Green
Write-Host "Set a fresh EMAIL_TO_TICKET_RECEIVED_AFTER value before the next test." -ForegroundColor Cyan
