const pool = require("../db/pool");

async function resolveMapping(catalogueItemId, catalogueType) {
  const r = await pool.query(
    `SELECT * FROM catalogue_category_mappings
     WHERE "catalogueItemId"=$1 AND "catalogueType"=$2`,
    [catalogueItemId, catalogueType]
  );
  if (r.rows.length === 1) {
    const m = r.rows[0];
    return {
      ticketCategory: m.ticketCategory,
      ticketSubCategory: m.ticketSubCategory,
      isLocked: m.isLocked,
      mappingStatus: m.mappingStatus,
      fallbackApplied: false,
    };
  }
  if (r.rows.length > 1) {
    return {
      mappingStatus: "ambiguous",
      ambiguousOptions: r.rows.map((m) => ({
        ticketCategory: m.ticketCategory,
        ticketSubCategory: m.ticketSubCategory,
        isLocked: m.isLocked,
      })),
      fallbackApplied: false,
    };
  }
  const fallback = await applyFallback({ catalogueType });
  return {
    ticketCategory: fallback.ticketCategory,
    ticketSubCategory: fallback.ticketSubCategory,
    isLocked: false,
    mappingStatus: "unmapped",
    fallbackApplied: true,
  };
}

async function applyFallback(item) {
  const r = await pool.query(
    `SELECT * FROM catalogue_fallback_categories
     WHERE "catalogueType"=$1 AND "isActive"=TRUE LIMIT 1`,
    [item.catalogueType]
  );
  if (r.rows.length) {
    return { ticketCategory: r.rows[0].ticketCategory, ticketSubCategory: r.rows[0].ticketSubCategory };
  }
  return { ticketCategory: "Other", ticketSubCategory: null };
}

async function validateSync(catalogueType) {
  const items = await pool.query(
    `SELECT i.id, i.category, i.sub_category, i.catalogue_type, i.item_name,
            m.ticketCategory, m.ticketSubCategory, m.mappingStatus, m.isLocked
     FROM workspace_catalogue_items i
     LEFT JOIN catalogue_category_mappings m ON m."catalogueItemId"=i.id AND m."catalogueType"=i.catalogue_type
     WHERE i.is_active=TRUE AND i.archived_at IS NULL
     ${catalogueType ? `AND i.catalogue_type=$1` : ""}`,
    catalogueType ? [catalogueType] : []
  );
  const results = items.rows.map((item) => {
    let status = item.mappingStatus || "unmapped";
    let mismatchReason = null;
    if (item.ticketCategory && item.category && item.ticketCategory !== item.category) {
      status = "mismatched";
      mismatchReason = `Catalogue category "${item.category}" does not match mapped ticket category "${item.ticketCategory}"`;
    }
    return {
      catalogueItemId: item.id,
      item_name: item.item_name,
      catalogueType: item.catalogue_type,
      catalogueCategory: item.category,
      ticketCategory: item.ticketCategory,
      mappingStatus: status,
      mismatchReason,
    };
  });
  const summary = {
    total: results.length,
    mapped: results.filter((x) => x.mappingStatus === "mapped").length,
    unmapped: results.filter((x) => x.mappingStatus === "unmapped").length,
    ambiguous: results.filter((x) => x.mappingStatus === "ambiguous").length,
    mismatched: results.filter((x) => x.mappingStatus === "mismatched").length,
  };
  return { summary, items: results };
}

async function upsertMapping(mapping) {
  const r = await pool.query(
    `INSERT INTO catalogue_category_mappings
       ("catalogueItemId","catalogueType","catalogueCategory","catalogueSubCategory","ticketCategory","ticketSubCategory","isLocked","mappingStatus","createdBy","updatedBy")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
     ON CONFLICT ("catalogueItemId","catalogueType") DO UPDATE SET
       "ticketCategory"=EXCLUDED."ticketCategory",
       "ticketSubCategory"=EXCLUDED."ticketSubCategory",
       "isLocked"=EXCLUDED."isLocked",
       "mappingStatus"=EXCLUDED."mappingStatus",
       "updatedBy"=EXCLUDED."updatedBy",
       "updatedAt"=NOW()
     RETURNING *`,
    [
      mapping.catalogueItemId,
      mapping.catalogueType,
      mapping.catalogueCategory || null,
      mapping.catalogueSubCategory || null,
      mapping.ticketCategory,
      mapping.ticketSubCategory || null,
      Boolean(mapping.isLocked),
      mapping.mappingStatus || "mapped",
      mapping.updatedBy || null,
    ]
  );
  return r.rows[0];
}

async function updateMapping(mappingId, updates) {
  const r = await pool.query(
    `UPDATE catalogue_category_mappings SET
       "ticketCategory"=COALESCE($2,"ticketCategory"),
       "ticketSubCategory"=COALESCE($3,"ticketSubCategory"),
       "isLocked"=COALESCE($4,"isLocked"),
       "mappingStatus"=COALESCE($5,"mappingStatus"),
       "updatedBy"=$6,
       "updatedAt"=NOW()
     WHERE "mappingId"=$1 RETURNING *`,
    [mappingId, updates.ticketCategory || null, updates.ticketSubCategory || null, updates.isLocked, updates.mappingStatus || null, updates.updatedBy || null]
  );
  return r.rows[0] || null;
}

module.exports = { resolveMapping, validateSync, upsertMapping, updateMapping, applyFallback };