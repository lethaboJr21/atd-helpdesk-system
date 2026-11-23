-- ATD Pulse Error Logger — error_log_entries, error_snapshots, root_cause_records
-- Captures errors from newly added code, snapshots project state, and records root cause

CREATE TABLE IF NOT EXISTS error_log_entries (
  "errorId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "correlationId" UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  "errorType" VARCHAR(120) NOT NULL,
  "errorMessage" TEXT NOT NULL,
  "stackTrace" TEXT,
  "sourceFile" VARCHAR(500),
  "buildVersion" VARCHAR(80),
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "severity" VARCHAR(20) NOT NULL DEFAULT 'Medium',
  "occurrenceCount" INT NOT NULL DEFAULT 1,
  "lastOccurredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "instrumentationMarker" VARCHAR(120),
  "dedupKey" VARCHAR(255) NOT NULL,
  "archived_at" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS error_snapshots (
  "snapshotId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "correlationId" UUID UNIQUE NOT NULL REFERENCES error_log_entries("correlationId") ON DELETE CASCADE,
  "activeRoute" VARCHAR(500),
  "componentHierarchy" JSONB,
  "userSessionContext" JSONB,
  "recentActionTrail" JSONB,
  "environmentMetadata" JSONB,
  "buildVersion" VARCHAR(80),
  "isPartial" BOOLEAN NOT NULL DEFAULT FALSE,
  "missingFields" TEXT[],
  "capturedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS root_cause_records (
  "rootCauseId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "correlationId" UUID UNIQUE NOT NULL REFERENCES error_log_entries("correlationId") ON DELETE CASCADE,
  "suspectedOrigin" TEXT,
  "contributingFactors" TEXT[],
  "status" VARCHAR(20) NOT NULL DEFAULT 'unconfirmed',
  "confirmedBy" INT,
  "reasoningTrail" TEXT,
  "inferredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "confirmedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_error_log_dedup_time ON error_log_entries ("dedupKey", "lastOccurredAt");
CREATE INDEX IF NOT EXISTS idx_error_log_severity_time ON error_log_entries ("severity", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_error_log_build ON error_log_entries ("buildVersion");
CREATE INDEX IF NOT EXISTS idx_root_cause_status ON root_cause_records ("status");
CREATE INDEX IF NOT EXISTS idx_error_log_timestamp ON error_log_entries ("timestamp" DESC);