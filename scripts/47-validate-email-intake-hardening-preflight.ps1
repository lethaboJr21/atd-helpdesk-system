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

$envPath = Join-Path $root "backend/.env"
$working = Join-Path $root "backend/.email-intake-hardening"
$csvPath = Join-Path $working "email-intake-before-hardening.csv"
$reportPath = Join-Path $root "email-intake-hardening-preflight.txt"

$requiredFiles = @(
    (Join-Path $working "inspect-email-intake.js"),
    (Join-Path $working "export-email-intake.js"),
    (Join-Path $working "inspect-ticket-relationships.js"),
    $csvPath,
    $reportPath
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        throw "Missing preflight output: $file"
    }
}

$enabledLine = Select-String -Path $envPath -Pattern '^EMAIL_TO_TICKET_ENABLED=' | Select-Object -First 1
if (-not $enabledLine) {
    throw "EMAIL_TO_TICKET_ENABLED is missing from backend/.env."
}

if ($enabledLine.Line.Trim().ToLowerInvariant() -ne "email_to_ticket_enabled=false") {
    throw "Automatic email intake must remain disabled."
}

$csvInfo = Get-Item $csvPath
if ($csvInfo.Length -le 20) {
    throw "CSV export is unexpectedly small: $($csvInfo.Length) bytes."
}

$reportText = [System.IO.File]::ReadAllText($reportPath)
$requiredReportTerms = @(
    "EMAIL INTAKE HARDENING PREFLIGHT",
    "PATTERN: EMAIL_TO_TICKET",
    "PATTERN: receivedDateTime",
    "PATTERN: acknowledge",
    "PATTERN: response.json",
    "PATTERN: runEmailIntake"
)

foreach ($term in $requiredReportTerms) {
    if (-not $reportText.Contains($term)) {
        throw "Hardening report is missing: $term"
    }
}

$trackedSensitive = @(
    git ls-files -- `
        "backend/.email-intake-hardening" `
        "email-intake-hardening-preflight.txt"
)

if ($trackedSensitive.Count -gt 0) {
    $trackedSensitive | Write-Host
    throw "Temporary hardening outputs must not be tracked by Git."
}

Write-Host "Email intake hardening preflight validation passed." -ForegroundColor Green
Write-Host "Automatic intake remains disabled." -ForegroundColor Green
Write-Host "CSV export and source report are ready for the hardening implementation." -ForegroundColor Cyan
