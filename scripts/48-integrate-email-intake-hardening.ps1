param([string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path)

$ErrorActionPreference = "Stop"
Set-Location $RepositoryRoot

$expectedBranch = "feature/resgo-ticket-trail-catalogue-integration"
if ((git branch --show-current).Trim() -ne $expectedBranch) {
  throw "Run this script on $expectedBranch."
}

$unexpected = @(git status --porcelain | Where-Object { $_ -notmatch '^\?\? email-intake-hardening-preflight\.txt$' })
if ($unexpected.Count -gt 0) {
  $unexpected | Write-Host
  throw "Working tree contains unexpected changes. Commit or restore them first."
}

$servicePath = "backend/src/services/emailTicketIntake.js"
$examplePath = "backend/EMAIL_TO_TICKET_ENV.example"
$migrationPath = "backend/src/db/migrations/2026-08-email-intake-hardening.sql"
foreach ($path in @($servicePath,$examplePath)) {
  if (-not (Test-Path $path)) { throw "Missing required file: $path" }
}
if (Test-Path $migrationPath) { throw "Migration already exists: $migrationPath" }

$backup = Join-Path $RepositoryRoot ".git/email-intake-hardening-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Copy-Item $servicePath (Join-Path $backup "emailTicketIntake.js") -Force
Copy-Item $examplePath (Join-Path $backup "EMAIL_TO_TICKET_ENV.example") -Force
Write-Host "Backup created: $backup" -ForegroundColor Cyan

$utf8 = New-Object System.Text.UTF8Encoding($false)
function Read-Lf([string]$Path) { [System.IO.File]::ReadAllText((Resolve-Path $Path).Path).Replace("`r`n","`n") }
function Write-Utf8([string]$Path,[string]$Text) { [System.IO.File]::WriteAllText((Resolve-Path $Path).Path,$Text,$utf8) }
function Replace-Once([string]$Text,[string]$Old,[string]$New,[string]$Label) {
  $oldLf=$Old.Replace("`r`n","`n"); $newLf=$New.Replace("`r`n","`n")
  $first=$Text.IndexOf($oldLf,[System.StringComparison]::Ordinal)
  if($first -lt 0){throw "$Label was not found."}
  if($Text.IndexOf($oldLf,$first+$oldLf.Length,[System.StringComparison]::Ordinal) -ge 0){throw "$Label appeared more than once."}
  return $Text.Remove($first,$oldLf.Length).Insert($first,$newLf)
}

$service = Read-Lf $servicePath
if ($service.Contains('receivedAfter: process.env.EMAIL_TO_TICKET_RECEIVED_AFTER')) {
  throw "Email intake hardening already appears installed."
}

$service = Replace-Once $service @'
    pageSize: Math.min(Math.max(Number(process.env.EMAIL_TO_TICKET_PAGE_SIZE) || 25, 1), 100),
'@ @'
    pageSize: Math.min(Math.max(Number(process.env.EMAIL_TO_TICKET_PAGE_SIZE) || 1, 1), 25),
    receivedAfter: String(process.env.EMAIL_TO_TICKET_RECEIVED_AFTER || "").trim(),
'@ "configuration hardening"

$service = Replace-Once $service @'
  if (!response.ok) throw new Error(`Graph request failed (${response.status}): ${await response.text()}`);
  if (response.status === 204) return null;
  return response.json();
'@ @'
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Graph request failed (${response.status}): ${responseText}`);
  }
  if (!responseText.trim()) return null;
  try {
    return JSON.parse(responseText);
  } catch (error) {
    throw new Error(`Graph returned invalid JSON (${response.status}): ${error.message}`);
  }
'@ "safe Graph response parsing"

$service = Replace-Once $service @'
function senderFrom(message = {}) {
  const address = message.replyTo?.[0]?.emailAddress || message.from?.emailAddress || message.sender?.emailAddress || {};
  return { email: String(address.address || "").trim().toLowerCase(), name: String(address.name || "").trim() };
}
'@ @'
function senderFrom(message = {}) {
  const address = message.replyTo?.[0]?.emailAddress || message.from?.emailAddress || message.sender?.emailAddress || {};
  return { email: String(address.address || "").trim().toLowerCase(), name: String(address.name || "").trim() };
}

function validSmtpAddress(value = "") {
  const email = String(value).trim().toLowerCase();
  if (!email || email.length > 254) return false;
  if (email.startsWith("/o=") || email.includes("imceaex") || email.includes("x500:")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function automatedMessageReason(message = {}, settings = config()) {
  const sender = senderFrom(message).email;
  const subject = String(message.subject || "").trim();
  const mailbox = String(settings.mailbox || "").trim().toLowerCase();
  if (!validSmtpAddress(sender)) return "invalid-or-legacy-sender";
  if (sender === mailbox) return "helpdesk-mailbox-message";
  if (/^(postmaster|mailer-daemon|no-?reply)@/i.test(sender) || /(^|[._-])no-?reply@/i.test(sender)) return "automated-sender";
  if (/^(automatic reply|auto(?:matic)? reply|out of office|undeliverable|delivery (?:has )?failed|non-delivery report|mail delivery failed)\s*:/i.test(subject)) return "automated-subject";
  if (/^\[(?:INC|REQ|CHG|PRJ)-\d+\]\s+We received your Helpdesk request/i.test(subject)) return "helpdesk-acknowledgement";
  if (/^\[Ticket #\d+\]/i.test(subject)) return "legacy-ticket-notification";
  return null;
}
'@ "message safety helpers"

$service = Replace-Once $service @'
async function acknowledge({ mailbox, recipient, senderName, ticketRef, title }, settings = config()) {
  if (!recipient) return;
'@ @'
async function acknowledge({ mailbox, recipient, senderName, ticketRef, title }, settings = config()) {
  if (!validSmtpAddress(recipient)) return { status: "skipped", reason: "invalid-recipient" };
'@ "acknowledgement recipient validation"

$service = Replace-Once $service @'
  await graphRequest(`/users/${encodeURIComponent(mailbox)}/sendMail`, { method: "POST", body: JSON.stringify(body) }, settings);
}
'@ @'
  await graphRequest(`/users/${encodeURIComponent(mailbox)}/sendMail`, { method: "POST", body: JSON.stringify(body) }, settings);
  return { status: "sent" };
}
'@ "acknowledgement result"

$service = Replace-Once $service @'
    try {
      await acknowledge({ mailbox: settings.mailbox, recipient: sender.email, senderName: sender.name,
        ticketRef, title }, settings);
      await pool.query("UPDATE email_ticket_intake SET status='acknowledged', updated_at=NOW() WHERE id=$1", [intakeId]);
    } catch (error) {
      console.error("Email ticket acknowledgement failed:", error.message);
      await pool.query("UPDATE email_ticket_intake SET error_message=$1, updated_at=NOW() WHERE id=$2", [error.message, intakeId]);
    }
'@ @'
    try {
      const acknowledgement = await acknowledge({ mailbox: settings.mailbox, recipient: sender.email, senderName: sender.name,
        ticketRef, title }, settings);
      const acknowledgementStatus = acknowledgement?.status || "skipped";
      await pool.query(
        `UPDATE email_ticket_intake
         SET status=CASE WHEN $1='sent' THEN 'acknowledged' ELSE status END,
             acknowledgement_status=$1, acknowledgement_error=NULL,
             acknowledged_at=CASE WHEN $1='sent' THEN NOW() ELSE acknowledged_at END,
             error_message=NULL, updated_at=NOW()
         WHERE id=$2`,
        [acknowledgementStatus, intakeId]
      );
    } catch (error) {
      console.error("Email ticket acknowledgement failed:", error.message);
      await pool.query(
        `UPDATE email_ticket_intake
         SET acknowledgement_status='failed', acknowledgement_error=$1,
             error_message=NULL, updated_at=NOW()
         WHERE id=$2`,
        [error.message, intakeId]
      );
    }
'@ "separate acknowledgement status"

$service = Replace-Once $service @'
async function listUnreadMessages(settings = config()) {
  const select = ["id", "internetMessageId", "conversationId", "subject", "body", "from", "sender", "replyTo", "receivedDateTime", "webLink", "importance", "isRead"].join(",");
  const path = `/users/${encodeURIComponent(settings.mailbox)}/mailFolders/inbox/messages?` +
    new URLSearchParams({
      "$filter": "isRead eq false",
      "$orderby": "receivedDateTime asc",
      "$top": String(settings.pageSize),
      "$select": select,
    }).toString();
  const payload = await graphRequest(path, {}, settings);
  return Array.isArray(payload?.value) ? payload.value : [];
}
'@ @'
async function listUnreadMessages(settings = config()) {
  const select = ["id", "internetMessageId", "conversationId", "subject", "body", "from", "sender", "replyTo", "receivedDateTime", "webLink", "importance", "isRead"].join(",");
  const filters = ["isRead eq false"];
  if (settings.receivedAfter) {
    const cutoff = new Date(settings.receivedAfter);
    if (Number.isNaN(cutoff.getTime())) {
      throw new Error("EMAIL_TO_TICKET_RECEIVED_AFTER must be a valid ISO-8601 timestamp.");
    }
    filters.push(`receivedDateTime ge ${cutoff.toISOString()}`);
  }
  const path = `/users/${encodeURIComponent(settings.mailbox)}/mailFolders/inbox/messages?` +
    new URLSearchParams({
      "$filter": filters.join(" and "),
      "$orderby": "receivedDateTime desc",
      "$top": String(settings.pageSize),
      "$select": select,
    }).toString();
  const payload = await graphRequest(path, {}, settings);
  return Array.isArray(payload?.value) ? payload.value : [];
}
'@ "newest-first cutoff query"

$service = Replace-Once $service @'
  for (const message of messages) {
    try {
      const result = await createTicketFromMessage(message, settings);
      results.push({ messageId: message.id, ok: true, ...result });
      if (!includeRead) await markRead(message.id, settings);
    } catch (error) {
'@ @'
  for (const message of messages) {
    try {
      const skipReason = automatedMessageReason(message, settings);
      if (skipReason) {
        results.push({ messageId: message.id, ok: true, skipped: true, reason: skipReason });
        if (!includeRead) await markRead(message.id, settings);
        continue;
      }
      const result = await createTicketFromMessage(message, settings);
      results.push({ messageId: message.id, ok: true, ...result });
      if (!includeRead) await markRead(message.id, settings);
    } catch (error) {
'@ "automated-message exclusion"

Write-Utf8 $servicePath $service

$migration = @'
BEGIN;

ALTER TABLE email_ticket_intake
  ADD COLUMN IF NOT EXISTS acknowledgement_status TEXT,
  ADD COLUMN IF NOT EXISTS acknowledgement_error TEXT,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS email_ticket_intake_ack_status_idx
  ON email_ticket_intake (acknowledgement_status, updated_at DESC);

COMMIT;
'@
[System.IO.File]::WriteAllText((Join-Path $RepositoryRoot $migrationPath),$migration,$utf8)

$example = Read-Lf $examplePath
if (-not $example.Contains("EMAIL_TO_TICKET_RECEIVED_AFTER=")) {
  $example += "`n# Ignore mailbox history before the production go-live timestamp (ISO-8601).`nEMAIL_TO_TICKET_RECEIVED_AFTER=2026-08-16T17:00:00+02:00`n"
}
$example = [regex]::Replace($example,'(?m)^EMAIL_TO_TICKET_PAGE_SIZE=.*$','EMAIL_TO_TICKET_PAGE_SIZE=1')
Write-Utf8 $examplePath $example

Remove-Item "email-intake-hardening-preflight.txt" -Force -ErrorAction SilentlyContinue
Write-Host "Email intake hardening integrated." -ForegroundColor Green
Write-Host "Added cutoff, newest-first intake, controlled batch size, automated-message exclusions and safe acknowledgement tracking." -ForegroundColor Cyan
Write-Host "Run scripts/49-validate-email-intake-hardening.ps1 next." -ForegroundColor Cyan
