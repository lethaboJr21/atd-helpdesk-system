const express = require("express");

const auth = require("../middleware/auth");
const pool = require("../db/pool");
const {
  getCatalog,
  partitionCatalog,
  getFormFields,
} = require("../services/catalogService");

const router = express.Router();
router.use(auth);

router.get("/service", async (_req, res) => {
  try {
    const workspace = await pool.query(
      `SELECT id FROM service_workspaces WHERE UPPER(code)='IT' ORDER BY id LIMIT 1`
    );
    if (workspace.rowCount) {
      const managed = await pool.query(
        `SELECT id,category,sub_category,item_name,user_description,icon_key,default_priority,
                priority_locked,summary_locked,default_summary,description_template,required_fields,
                optional_fields,visibility,display_order,is_other,is_active
           FROM workspace_catalogue_items
          WHERE workspace_id=$1 AND catalogue_type='service_request'
            AND archived_at IS NULL AND is_active=TRUE
          ORDER BY display_order,category,sub_category NULLS FIRST,item_name`,
        [workspace.rows[0].id]
      );
      if (managed.rowCount) {
        const categoryMap = new Map();
        const items = managed.rows.map((row) => {
          const source = row.visibility?.productionSource || {};
          const raw = source.rawItem || {};
          const rawCategory = source.rawCategory || {};
          const categoryId = String(raw.categoryId || raw.category_id || rawCategory.id || row.category);
          if (!categoryMap.has(categoryId)) {
            categoryMap.set(categoryId, {
              id: categoryId,
              name: row.category,
              description: rawCategory.description || "",
              position: Number(rawCategory.position ?? row.display_order ?? 0),
              kind: "service",
            });
          }
          return {
            id: String(source.productionId || raw.id || `managed-${row.id}`),
            managedCatalogueItemId: row.id,
            name: row.item_name,
            description: row.user_description || "",
            categoryId,
            categoryName: row.category,
            ticketCategory: raw.ticketCategory || row.category,
            ticketSubCategory: raw.ticketSubCategory || row.sub_category || null,
            deliveryTimeHours: raw.deliveryTimeHours ?? null,
            eta: raw.eta ?? null,
            allowQuantity: Boolean(raw.allowQuantity),
            allowAttachments: raw.allowAttachments !== false,
            iconName: raw.iconName || row.icon_key || null,
            popular: Boolean(raw.popular),
            kind: "service",
            source: "managed",
            isOther: Boolean(row.is_other),
            defaultPriority: row.default_priority,
            priorityLocked: Boolean(row.priority_locked),
            summaryLocked: Boolean(row.summary_locked),
            defaultSummary: row.default_summary,
            descriptionTemplate: row.description_template,
            requiredFields: row.required_fields || [],
            optionalFields: row.optional_fields || [],
          };
        });
        return res.json({
          source: "managed-workspace-catalogue",
          categories: Array.from(categoryMap.values()).sort((a,b)=>a.position-b.position || a.name.localeCompare(b.name)),
          items,
        });
      }
    }

    // Compatibility fallback: keep the existing catalogue service available until managed records exist.
    const catalog = partitionCatalog(await getCatalog());
    return res.json({
      source: catalog.source,
      categories: catalog.service.categories,
      items: catalog.service.items,
    });
  } catch (error) {
    console.error("Service catalog failed:", error);
    return res.status(503).json({ error: "Service catalog is temporarily unavailable." });
  }
});

router.get("/assets", async (_req, res) => {
  try {
    const catalog = partitionCatalog(await getCatalog());
    return res.json({
      source: catalog.source,
      categories: catalog.asset.categories,
      items: catalog.asset.items,
    });
  } catch (error) {
    console.error("Asset catalog failed:", error);
    return res.status(503).json({ error: "Asset catalog is temporarily unavailable." });
  }
});

router.get("/fields", async (_req, res) => {
  try {
    const fields = await getFormFields();
    return res.json(fields);
  } catch (error) {
    console.error("Catalog fields failed:", error);
    return res.status(503).json({ error: "Request form fields are temporarily unavailable." });
  }
});

// SCRIPT_999_V4_DIRECT_MANAGED_CATALOGUE
router.get("/managed-it-services", async (req,res,next) => {
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout='5000ms'");
    const result=await client.query(`SELECT i.id,i.category,i.sub_category,i.item_name,i.user_description,i.default_priority,i.priority_locked,i.summary_locked,i.default_summary,i.default_group_id,i.default_assignee_user_id,i.display_order FROM workspace_catalogue_items i JOIN service_workspaces w ON w.id=i.workspace_id WHERE UPPER(w.code)='IT' AND LOWER(COALESCE(w.status,'draft')) NOT IN ('archived','disabled','inactive') AND i.catalogue_type='service_request' AND i.is_active=TRUE AND i.archived_at IS NULL ORDER BY i.category,i.sub_category NULLS FIRST,i.display_order,i.item_name`);
    await client.query("COMMIT");
    return res.json({items:result.rows.map(x=>({id:x.id,managedCatalogueItemId:x.id,name:x.item_name,description:x.user_description||"",categoryId:x.category,categoryName:x.category,ticketCategory:x.category,ticketSubCategory:x.sub_category,subCategory:x.sub_category,priority:x.default_priority||"Medium",priorityLocked:x.priority_locked,summaryLocked:x.summary_locked,defaultSummary:x.default_summary,defaultGroupId:x.default_group_id,defaultAssigneeUserId:x.default_assignee_user_id,workspace:"IT",displayOrder:x.display_order}))});
  } catch(error){await client.query("ROLLBACK").catch(()=>{});next(error);} finally {client.release();}
});

module.exports = router;
