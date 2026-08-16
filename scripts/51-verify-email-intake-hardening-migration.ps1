param([string]$RepositoryRoot = "")

$ErrorActionPreference = "Stop"

if ($RepositoryRoot) {
  $root = (Resolve-Path $RepositoryRoot).Path
}
elseif (Test-Path (Join-Path (Get-Location).Path "backend/src/db/pool.js")) {
  $root = (Get-Location).Path
}
elseif ((Split-Path (Get-Location).Path -Leaf) -eq "backend") {
  $root = (Resolve-Path "..").Path
}
else {
  throw "Run this script from the repository root or backend directory."
}

$backend = Join-Path $root "backend"
$tempPath = Join-Path $backend ".verify-email-intake-hardening.js"
$nodeScript = @'
require("dotenv").config();
const pool = require("./src/db/pool");

async function run() {
  const columns = await pool.query(`
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

  const index = await pool.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'email_ticket_intake'
      AND indexname = 'email_ticket_intake_ack_status_idx'
  `);

  console.table(columns.rows);
  console.table(index.rows);

  if (columns.rows.length !== 3) {
    throw new Error(`Expected 3 columns but found ${columns.rows.length}.`);
  }
  if (index.rows.length !== 1) {
    throw new Error("Acknowledgement status index is missing.");
  }
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
    node ".verify-email-intake-hardening.js"
    if ($LASTEXITCODE -ne 0) {
      throw "Email intake hardening migration verification failed."
    }
  }
  finally {
    Pop-Location
  }
}
finally {
  Remove-Item $tempPath -Force -ErrorAction SilentlyContinue
}

Write-Host "Email intake hardening migration verification passed." -ForegroundColor Green
