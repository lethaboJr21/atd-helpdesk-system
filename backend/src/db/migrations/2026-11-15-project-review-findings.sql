-- Project Review findings table for codebase scan results

CREATE TABLE IF NOT EXISTS project_review_findings (
  "findingId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "description" TEXT NOT NULL,
  "affectedArea" VARCHAR(300),
  "classification" VARCHAR(40) NOT NULL DEFAULT 'debt',
  "impact" VARCHAR(10) NOT NULL DEFAULT 'Medium',
  "effort" VARCHAR(10) NOT NULL DEFAULT 'Medium',
  "linkedCapability" VARCHAR(80),
  "scanDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "scanId" UUID
);

CREATE INDEX IF NOT EXISTS idx_review_findings_class_impact ON project_review_findings ("classification", "impact");
CREATE INDEX IF NOT EXISTS idx_review_findings_scan_date ON project_review_findings ("scanId", "scanDate" DESC);