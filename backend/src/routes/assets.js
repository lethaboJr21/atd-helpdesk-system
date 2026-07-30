const router = require("express").Router();
const axios = require("axios");
const auth = require("../middleware/auth");

router.use(auth);

const AMS_API_URL =
  process.env.AMS_API_URL ||
  "https://portal.atdalliance.co.za/ams/api/helpdesk_api.php";

const AMS_API_TOKEN = process.env.AMS_API_TOKEN || "";

const FULL_INVENTORY_ROLES = new Set([
  "agent",
  "operator",
  "manager",
  "admin",
  "superadmin",
]);

function canViewAllAssets(req) {
  return FULL_INVENTORY_ROLES.has(String(req.user?.role || "").toLowerCase());
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || "").trim();
}

function getCurrentUserIdentity(req) {
  return {
    email: normalizeEmail(req.user?.email),
    name: normalizeName(req.user?.name),
  };
}

async function amsGet(params) {
  if (!AMS_API_TOKEN) {
    throw new Error("AMS_API_TOKEN is not configured in backend/.env");
  }

  const response = await axios.get(AMS_API_URL, {
    params,
    headers: { "X-AMS-Token": AMS_API_TOKEN },
    timeout: 15000,
  });

  return response.data;
}

async function getEmployeeAssets({ email, name }) {
  if (!email && !name) {
    return { employee: null, assets: [] };
  }

  const data = await amsGet({
    action: "employee_assets",
    email: email || undefined,
    name: name || undefined,
  });

  if (!data.success) {
    const error = new Error(data.error || "AMS error");
    error.status = 502;
    throw error;
  }

  return {
    employee: data.employee || null,
    assets: Array.isArray(data.assets) ? data.assets : [],
  };
}

function filterAssets(assets, query) {
  const type = String(query.type || "").trim();
  const status = String(query.status || "").trim();
  const search = String(query.q || "").trim().toLowerCase();

  return assets.filter((asset) => {
    const matchesType = !type || asset.type === type;
    const matchesStatus = !status || asset.status === status;

    const text = [
      asset.asset_tag,
      asset.serial_number,
      asset.name,
      asset.brand,
      asset.model,
      asset.hostname,
      asset.used_by,
      asset.department,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return matchesType && matchesStatus && (!search || text.includes(search));
  });
}

function buildStats(assets) {
  const byStatus = {};
  const byType = {};

  for (const asset of assets) {
    const status = asset.status || "unknown";
    const type = asset.type || "Other";
    byStatus[status] = (byStatus[status] || 0) + 1;
    byType[type] = (byType[type] || 0) + 1;
  }

  return {
    success: true,
    total: assets.length,
    by_status: byStatus,
    by_type: byType,
  };
}

/**
 * GET /api/assets
 * Privileged roles receive the full inventory.
 * Standard users receive only assets assigned to their own Helpdesk identity.
 */
router.get("/", async (req, res) => {
  try {
    if (canViewAllAssets(req)) {
      const data = await amsGet({
        action: "assets",
        type: req.query.type || undefined,
        status: req.query.status || undefined,
        q: req.query.q || undefined,
      });

      if (!data.success) {
        return res.status(502).json({ error: data.error || "AMS error" });
      }

      return res.json(Array.isArray(data.assets) ? data.assets : []);
    }

    const identity = getCurrentUserIdentity(req);
    const result = await getEmployeeAssets(identity);
    return res.json(filterAssets(result.assets, req.query));
  } catch (err) {
    console.error("AMS assets fetch error:", err.message);
    return res.status(err.status || 502).json({ error: "Failed to reach AMS" });
  }
});

/** GET /api/assets/stats */
router.get("/stats", async (req, res) => {
  try {
    if (canViewAllAssets(req)) {
      const data = await amsGet({ action: "stats" });
      if (!data.success) {
        return res.status(502).json({ error: data.error || "AMS error" });
      }
      return res.json(data);
    }

    const result = await getEmployeeAssets(getCurrentUserIdentity(req));
    return res.json(buildStats(result.assets));
  } catch (err) {
    console.error("AMS stats fetch error:", err.message);
    return res.status(err.status || 502).json({ error: "Failed to reach AMS" });
  }
});

/**
 * GET /api/assets/by-user
 * Standard users are always restricted to themselves.
 * Privileged roles may supply another employee's email/name.
 */
router.get("/by-user", async (req, res) => {
  let identity;

  if (canViewAllAssets(req)) {
    identity = {
      email: normalizeEmail(req.query.email),
      name: normalizeName(req.query.name),
    };

    if (!identity.email && !identity.name) {
      identity = getCurrentUserIdentity(req);
    }
  } else {
    identity = getCurrentUserIdentity(req);
  }

  if (!identity.email && !identity.name) {
    return res.status(400).json({
      error: "The current user does not have an email or name for asset matching.",
    });
  }

  try {
    const data = await getEmployeeAssets(identity);
    return res.json(data);
  } catch (err) {
    console.error("AMS employee assets fetch error:", err.message);
    return res.status(err.status || 502).json({ error: "Failed to reach AMS" });
  }
});

/**
 * GET /api/assets/:id
 * Standard users may only open an asset currently assigned to themselves.
 */
router.get("/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid asset id" });
  }

  try {
    if (!canViewAllAssets(req)) {
      const ownAssets = await getEmployeeAssets(getCurrentUserIdentity(req));
      const allowed = ownAssets.assets.some(
        (asset) => String(asset.id) === String(id)
      );

      if (!allowed) {
        return res.status(403).json({
          error: "You can only view assets currently assigned to your account.",
        });
      }
    }

    const data = await amsGet({ action: "asset", id });

    if (!data.success) {
      return res.status(404).json({ error: data.error || "Asset not found" });
    }

    return res.json(data.asset);
  } catch (err) {
    console.error("AMS asset detail fetch error:", err.message);
    return res.status(err.status || 502).json({ error: "Failed to reach AMS" });
  }
});

module.exports = router;
