const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

module.exports = async function authMiddleware(request, response, next) {
  const authorizationHeader = request.headers.authorization;
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return response.status(401).json({ code: "TOKEN_REQUIRED", error: "Unauthorised - token required" });
  }

  const token = authorizationHeader.slice(7).trim();
  if (!token) return response.status(401).json({ code: "TOKEN_REQUIRED", error: "Unauthorised - token required" });

  try {
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured.");
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    const result = await pool.query(
      `SELECT id,name,email,role,status,approved,microsoft_id,microsoft_account_enabled,archived_at,last_login_at,account_type,deactivated_at FROM users WHERE id=$1 LIMIT 1`,
      [payload.id]
    );
    const user = result.rows[0];

    if (!user) return response.status(401).json({ code: "ACCOUNT_NOT_FOUND", error: "Unauthorised - account no longer exists" });
    if (user.archived_at) return response.status(403).json({ code: "ACCOUNT_ARCHIVED", error: "This account has been archived" });
    if (!user.approved || user.role === "pending") return response.status(403).json({ code: "ACCOUNT_PENDING", error: "This account is awaiting approval" });
    if (user.status !== "active") return response.status(403).json({ code: "ACCOUNT_DEACTIVATED", error: "This account is inactive or deactivated" });
    if (user.microsoft_account_enabled === false) return response.status(403).json({ code: "MICROSOFT_ACCOUNT_DISABLED", error: "The linked Microsoft account is disabled" });
    if (user.account_type && user.account_type !== "person") return response.status(403).json({ code: "NON_PERSON_ACCOUNT", error: "This account is not permitted to sign in interactively" });

    request.user = user;
    request.tokenPayload = payload;
    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") return response.status(401).json({ code: "TOKEN_EXPIRED", error: "Unauthorised - token expired" });
    if (error.name === "JsonWebTokenError") return response.status(401).json({ code: "TOKEN_INVALID", error: "Unauthorised - invalid token" });
    console.error("Authentication middleware failed:", { message: error.message, code: error.code || null });
    return response.status(500).json({ error: "Authentication validation failed" });
  }
};
