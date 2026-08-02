const jwt = require("jsonwebtoken");

const pool = require("../db/pool");

const FEATURE_DEFAULTS = Object.freeze({
  employee_dashboard: true,
  my_tickets: true,
  my_assets: true,
  report_incident: true,
  request_service: true,
  request_asset: true,
  request_change: true,
  knowledge: true,
  notifications: true,
  operations_dashboard: true,
  ticket_workspace: true,
  asset_register: true,
  production_operations: true,
  user_management: true,
  group_management: true,
  admin_settings: true,
});

async function getFeatureEntitlements(userId) {
  const result = await pool.query(
    `SELECT feature_key, enabled
       FROM user_feature_entitlements
      WHERE user_id = $1`,
    [userId]
  );

  return Object.fromEntries(
    result.rows.map((row) => [row.feature_key, row.enabled])
  );
}

function buildEffectiveFeatures(user, overrides) {
  const employee = user.role === "user";
  const operational = ["agent", "operator", "manager", "admin", "superadmin"].includes(user.role);
  const administrator = ["manager", "admin", "superadmin"].includes(user.role);

  const baseline = {
    ...FEATURE_DEFAULTS,
    operations_dashboard: operational,
    ticket_workspace: operational,
    asset_register: operational,
    production_operations: operational,
    user_management: administrator,
    group_management: administrator,
    admin_settings: administrator,
  };

  if (employee) {
    baseline.operations_dashboard = false;
    baseline.ticket_workspace = false;
    baseline.asset_register = false;
    baseline.production_operations = false;
    baseline.user_management = false;
    baseline.group_management = false;
    baseline.admin_settings = false;
  }

  return Object.fromEntries(
    Object.entries(baseline).map(([key, value]) => [
      key,
      Object.prototype.hasOwnProperty.call(overrides, key)
        ? Boolean(overrides[key]) && value
        : value,
    ])
  );
}

module.exports = async function authMiddleware(request, response, next) {
  const authorizationHeader = request.headers.authorization;

  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return response.status(401).json({
      code: "TOKEN_REQUIRED",
      error: "Unauthorised - token required",
    });
  }

  const token = authorizationHeader.slice(7).trim();

  if (!token) {
    return response.status(401).json({
      code: "TOKEN_REQUIRED",
      error: "Unauthorised - token required",
    });
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured.");
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    const result = await pool.query(
      `SELECT
         id, name, email, role, status, approved, microsoft_id,
         microsoft_account_enabled, archived_at, last_login_at,
         account_type, deactivated_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [payload.id]
    );

    const user = result.rows[0];

    if (!user) {
      return response.status(401).json({
        code: "ACCOUNT_NOT_FOUND",
        error: "Unauthorised - account no longer exists",
      });
    }

    if (user.archived_at) {
      return response.status(403).json({
        code: "ACCOUNT_ARCHIVED",
        error: "This account has been archived",
      });
    }

    if (!user.approved || user.role === "pending") {
      return response.status(403).json({
        code: "ACCOUNT_PENDING",
        error: "This account is awaiting approval",
      });
    }

    if (user.status !== "active" || user.deactivated_at) {
      return response.status(403).json({
        code: "ACCOUNT_DEACTIVATED",
        error: "This account is inactive or deactivated",
      });
    }

    if (user.microsoft_account_enabled === false) {
      return response.status(403).json({
        code: "MICROSOFT_ACCOUNT_DISABLED",
        error: "The linked Microsoft account is disabled",
      });
    }

    if (user.account_type !== "person") {
      return response.status(403).json({
        code: "NON_PERSON_ACCOUNT",
        error: "This account is not permitted to sign in interactively",
      });
    }

    let overrides = {};

    try {
      overrides = await getFeatureEntitlements(user.id);
    } catch (featureError) {
      if (featureError.code !== "42P01") {
        throw featureError;
      }
    }

    request.user = {
      ...user,
      features: buildEffectiveFeatures(user, overrides),
    };
    request.tokenPayload = payload;

    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return response.status(401).json({
        code: "TOKEN_EXPIRED",
        error: "Unauthorised - token expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return response.status(401).json({
        code: "TOKEN_INVALID",
        error: "Unauthorised - invalid token",
      });
    }

    console.error("Authentication middleware failed:", {
      message: error.message,
      code: error.code || null,
    });

    return response.status(500).json({
      error: "Authentication validation failed",
    });
  }
};
