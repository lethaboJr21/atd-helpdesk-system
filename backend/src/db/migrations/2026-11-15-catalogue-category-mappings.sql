-- Catalogue-Category mappings and fallback categories
-- Syncs catalogue items with ticket categories for consistent ticket creation

CREATE TABLE IF NOT EXISTS catalogue_category_mappings (
  "mappingId" BIGSERIAL PRIMARY KEY,
  "catalogueItemId" BIGINT NOT NULL,
  "catalogueType" VARCHAR(30) NOT NULL,
  "catalogueCategory" VARCHAR(160),
  "catalogueSubCategory" VARCHAR(180),
  "ticketCategory" VARCHAR(160) NOT NULL,
  "ticketSubCategory" VARCHAR(180),
  "isLocked" BOOLEAN NOT NULL DEFAULT FALSE,
  "mappingStatus" VARCHAR(20) NOT NULL DEFAULT 'mapped',
  "fallbackCategory" VARCHAR(160),
  "createdBy" INT,
  "updatedBy" INT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalogue_fallback_categories (
  "fallbackId" BIGSERIAL PRIMARY KEY,
  "catalogueType" VARCHAR(30) NOT NULL,
  "ticketCategory" VARCHAR(160) NOT NULL,
  "ticketSubCategory" VARCHAR(180),
  "priority" VARCHAR(20) DEFAULT 'Medium',
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cat_map_item_type ON catalogue_category_mappings ("catalogueItemId", "catalogueType");
CREATE INDEX IF NOT EXISTS idx_cat_map_status ON catalogue_category_mappings ("mappingStatus");

INSERT INTO catalogue_fallback_categories ("catalogueType", "ticketCategory", "priority", "isActive") VALUES
  ('service_request', 'Other', 'Medium', TRUE),
  ('incident', 'Other', 'Medium', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO catalogue_category_mappings ("catalogueItemId", "catalogueType", "catalogueCategory", "catalogueSubCategory", "ticketCategory", "ticketSubCategory", "mappingStatus", "isLocked")
SELECT
  i.id,
  'service_request',
  i.category,
  i.sub_category,
  COALESCE(i.category, 'Other'),
  i.sub_category,
  'mapped',
  FALSE
FROM workspace_catalogue_items i
WHERE i.is_active = TRUE AND i.archived_at IS NULL AND i.catalogue_type = 'service_request'
ON CONFLICT ("catalogueItemId", "catalogueType") DO NOTHING;

INSERT INTO catalogue_category_mappings ("catalogueItemId", "catalogueType", "catalogueCategory", "catalogueSubCategory", "ticketCategory", "ticketSubCategory", "mappingStatus", "isLocked")
SELECT
  i.id,
  'incident',
  i.category,
  i.sub_category,
  COALESCE(i.category, 'Other'),
  i.sub_category,
  'mapped',
  FALSE
FROM workspace_catalogue_items i
WHERE i.is_active = TRUE AND i.archived_at IS NULL AND i.catalogue_type = 'incident'
ON CONFLICT ("catalogueItemId", "catalogueType") DO NOTHING;