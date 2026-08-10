const express = require("express");

const auth = require("../middleware/auth");
const {
  getCatalog,
  partitionCatalog,
  getFormFields,
} = require("../services/catalogService");

const router = express.Router();
router.use(auth);

router.get("/service", async (_req, res) => {
  try {
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

module.exports = router;
