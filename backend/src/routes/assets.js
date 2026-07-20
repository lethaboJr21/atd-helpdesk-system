const router = require("express").Router();
const axios = require("axios");
const auth = require("../middleware/auth");

router.use(auth);

/**
 * ✅ Assets routes — proxy to the AMS (Asset Management System).
 *
 * AMS is a separate PHP system and stays the single source of truth for
 * assets. The helpdesk never writes to it — these routes are read-only
 * proxies so the AMS token is never exposed to the browser.
 */
const AMS_API_URL =
  process.env.AMS_API_URL ||
  "https://portal.atdalliance.co.za/ams/api/helpdesk_api.php";

// Shared secret — set AMS_API_TOKEN in backend/.env (never commit it)
const AMS_API_TOKEN = process.env.AMS_API_TOKEN || "";

async function amsGet(params) {
  if (!AMS_API_TOKEN) {
    const err = new Error("AMS_API_TOKEN is not configured in backend/.env");
    throw err;
  }

  const response = await axios.get(AMS_API_URL, {
    params,
    headers: { "X-AMS-Token": AMS_API_TOKEN },
    timeout: 15000,
  });

  return response.data;
}

/**
 * GET /api/assets
 * Full asset list. Optional query params: type, status, q (search).
 */
router.get("/", async (req, res) => {
  try {
    const data = await amsGet({
      action: "assets",
      type: req.query.type || undefined,
      status: req.query.status || undefined,
      q: req.query.q || undefined,
    });

    if (!data.success) {
      return res.status(502).json({ error: data.error || "AMS error" });
    }

    return res.json(data.assets);
  } catch (err) {
    console.error("AMS assets fetch error:", err.message);
    return res.status(502).json({ error: "Failed to reach AMS" });
  }
});

/**
 * GET /api/assets/stats
 * Summary counts by status and type for dashboard widgets.
 */
router.get("/stats", async (_req, res) => {
  try {
    const data = await amsGet({ action: "stats" });

    if (!data.success) {
      return res.status(502).json({ error: data.error || "AMS error" });
    }

    return res.json(data);
  } catch (err) {
    console.error("AMS stats fetch error:", err.message);
    return res.status(502).json({ error: "Failed to reach AMS" });
  }
});

/**
 * GET /api/assets/by-user?email=...&name=...
 * Assets currently held by an employee — for ticket requester context.
 */
router.get("/by-user", async (req, res) => {
  const { email, name } = req.query;

  if (!email && !name) {
    return res.status(400).json({ error: "email or name required" });
  }

  try {
    const data = await amsGet({
      action: "employee_assets",
      email: email || undefined,
      name: name || undefined,
    });

    if (!data.success) {
      return res.status(502).json({ error: data.error || "AMS error" });
    }

    return res.json({ employee: data.employee, assets: data.assets });
  } catch (err) {
    console.error("AMS employee assets fetch error:", err.message);
    return res.status(502).json({ error: "Failed to reach AMS" });
  }
});

/**
 * GET /api/assets/:id
 * Single asset detail with assignment history.
 */
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (!id || id < 1) {
    return res.status(400).json({ error: "Invalid asset id" });
  }

  try {
    const data = await amsGet({ action: "asset", id });

    if (!data.success) {
      return res.status(404).json({ error: data.error || "Asset not found" });
    }

    return res.json(data.asset);
  } catch (err) {
    console.error("AMS asset detail fetch error:", err.message);
    return res.status(502).json({ error: "Failed to reach AMS" });
  }
});

module.exports = router;
