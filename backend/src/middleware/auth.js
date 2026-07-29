const jwt = require("jsonwebtoken");

const pool = require("../db/pool");

module.exports = async function authMiddleware(
  request,
  response,
  next
) {
  const authorizationHeader = request.headers.authorization;

  if (
    !authorizationHeader ||
    !authorizationHeader.startsWith("Bearer ")
  ) {
    return response.status(401).json({
      error: "Unauthorised - token required",
    });
  }

  const token = authorizationHeader.slice(7).trim();

  if (!token) {
    return response.status(401).json({
      error: "Unauthorised - token required",
    });
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        algorithms: ["HS256"],
      }
    );

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        role,
        status,
        approved,
        microsoft_id,
        microsoft_account_enabled,
        archived_at
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [payload.id]
    );

    const currentUser = result.rows[0];

    if (!currentUser) {
      return response.status(401).json({
        error: "Unauthorised - account no longer exists",
      });
    }

    if (currentUser.archived_at) {
      return response.status(403).json({
        error: "This account has been archived",
      });
    }

    if (
      !currentUser.approved ||
      currentUser.status !== "active"
    ) {
      return response.status(403).json({
        error: "This account is awaiting approval or inactive",
      });
    }

    if (currentUser.microsoft_account_enabled === false) {
      return response.status(403).json({
        error: "The linked Microsoft account is disabled",
      });
    }

    request.user = currentUser;
    request.tokenPayload = payload;

    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return response.status(401).json({
        error: "Unauthorised - token expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return response.status(401).json({
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
