ALTER TABLE error_log_entries
  ADD COLUMN IF NOT EXISTS "resolutionStatus" VARCHAR(20) NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS "resolutionSolution" TEXT,
  ADD COLUMN IF NOT EXISTS "fixedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "fixedBy" INTEGER REFERENCES users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'error_log_resolution_status_check'
  ) THEN
    ALTER TABLE error_log_entries
      ADD CONSTRAINT error_log_resolution_status_check
      CHECK ("resolutionStatus" IN ('open', 'investigating', 'fixed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_error_log_resolution_status_time
  ON error_log_entries ("resolutionStatus", "timestamp" DESC);
