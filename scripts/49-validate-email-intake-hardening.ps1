param([string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path)

$ErrorActionPreference = "Stop"
Set-Location $RepositoryRoot

$servicePath = "backend/src/services/emailTicketIntake.js"
$migrationPath = "backend/src/db/migrations/2026-08-email-intake-hardening.sql"
$examplePath = "backend/EMAIL_TO_TICKET_ENV.example"
foreach ($path in @($servicePath,$migrationPath,$examplePath)) {
  if (-not (Test-Path $path)) { throw "Missing expected file: $path" }
}

$service = [System.IO.File]::ReadAllText((Resolve-Path $servicePath).Path)
$required = @(
  'EMAIL_TO_TICKET_RECEIVED_AFTER',
  'receivedDateTime desc',
  'automatedMessageReason',
  'validSmtpAddress',
  'invalid-or-legacy-sender',
  'automated-subject',
  'legacy-ticket-notification',
  'acknowledgement_status',
  'acknowledgement_error',
  'if (!responseText.trim()) return null',
  'JSON.parse(responseText)'
)
foreach ($term in $required) {
  if (-not $service.Contains($term)) { throw "emailTicketIntake.js is missing: $term" }
}
if ($service.Contains('"$orderby": "receivedDateTime asc"')) { throw "Oldest-first ordering remains." }

$migration = [System.IO.File]::ReadAllText((Resolve-Path $migrationPath).Path)
foreach ($term in @('acknowledgement_status','acknowledgement_error','acknowledged_at')) {
  if (-not $migration.Contains($term)) { throw "Migration is missing: $term" }
}
if ($migration -match '(?im)\b(DROP|TRUNCATE|DELETE\s+FROM)\b') { throw "Migration contains destructive SQL." }

$example = [System.IO.File]::ReadAllText((Resolve-Path $examplePath).Path)
if (-not $example.Contains('EMAIL_TO_TICKET_PAGE_SIZE=1')) { throw "Example batch size is not 1." }
if (-not $example.Contains('EMAIL_TO_TICKET_RECEIVED_AFTER=')) { throw "Example cutoff is missing." }

node --check $servicePath
if ($LASTEXITCODE -ne 0) { throw "emailTicketIntake.js syntax check failed." }

$markers = @(git grep -n -E '^(<<<<<<<|=======|>>>>>>>)' -- $servicePath $migrationPath $examplePath)
if ($LASTEXITCODE -eq 0 -and $markers.Count -gt 0) { $markers; throw "Conflict markers remain." }

$unsafe = @(git status --porcelain | Where-Object { $_ -match '(^|/)(\.env|node_modules|dist)(/|$)|\.(pem|key|log)$|backup|dump' })
if ($unsafe.Count -gt 0) { $unsafe | Write-Host; throw "Unsafe or generated files are present." }

Write-Host "Email intake hardening validation passed." -ForegroundColor Green
Write-Host "Confirmed: cutoff, newest-first processing, controlled batch size, loop exclusions and safe acknowledgement tracking." -ForegroundColor Cyan
Write-Host "Apply the migration and set a fresh local EMAIL_TO_TICKET_RECEIVED_AFTER before the next manual test." -ForegroundColor Yellow
