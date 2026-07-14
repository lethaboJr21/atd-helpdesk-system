//This file contains the authentication routes for the backend. It handles login, logout, and fetching the current user's info. The original code used a PostgreSQL database to store users and bcrypt for password hashing, but it has been temporarily replaced with hardcoded dev users for development purposes. The JWT token is generated upon successful login and includes the user's ID, email, role, and name.
const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");
const auth = require("../middleware/auth");
const axios = require("axios");
const crypto = require("crypto");
const { sendM365WelcomeEmail } = require("../services/email");

/**
 * ✅ Create JWT token after successful login
 * The token stores basic user identity and role.
 */
function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    }
  );
}
  function getMicrosoftConfig() {
  const tenantId =
    process.env.MICROSOFT_TENANT_ID || process.env.AZURE_TENANT_ID;

  const clientId =
    process.env.MICROSOFT_CLIENT_ID || process.env.AZURE_CLIENT_ID;

  const clientSecret =
    process.env.MICROSOFT_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET;

  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI ||
    "http://localhost:3001/api/auth/microsoft/callback";

  const allowedDomain =
    process.env.MICROSOFT_ALLOWED_DOMAIN || "atdalliance.co.za";

  return {
    tenantId,
    clientId,
    clientSecret,
    redirectUri,
    allowedDomain,
  };
}

function getPortalRedirectUrl(path = "/") {
  const base = process.env.PUBLIC_PORTAL_URL || "http://localhost:5173/helpdesk/login";
  return `${base}${path}`;
}

function getEmailDomain(email) {
  return String(email || "").split("@")[1]?.toLowerCase() || "";
}

function buildMicrosoftAuthorizeUrl(state) {
  const { tenantId, clientId, redirectUri } = getMicrosoftConfig();

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: "openid profile email User.Read",
    state,
    prompt: "select_account",
  });

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

async function exchangeMicrosoftCodeForToken(code) {
  const { tenantId, clientId, clientSecret, redirectUri } =
    getMicrosoftConfig();

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: "openid profile email User.Read",
  });

  const { data } = await axios.post(tokenUrl, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return data;
}

async function getMicrosoftMe(accessToken) {
  const { data } = await axios.get(
    "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return data;
}

async function findOrCreateMicrosoftUser(profile) {
  const email = String(
    profile.mail || profile.userPrincipalName || ""
  ).toLowerCase();

  const name = profile.displayName || email;
  const { allowedDomain } = getMicrosoftConfig();

  if (!email) {
    const error = new Error("Microsoft account did not return an email address.");
    error.status = 400;
    throw error;
  }

  if (getEmailDomain(email) !== allowedDomain.toLowerCase()) {
    const error = new Error(`Only @${allowedDomain} accounts are allowed.`);
    error.status = 403;
    throw error;
  }

  const existing = await pool.query(
    `
    SELECT id, name, email, role, approved
    FROM users
    WHERE LOWER(email) = LOWER($1)
    `,
    [email]
  );

  if (existing.rows[0]) {
    const user = existing.rows[0];

    // If a pending user signs in with valid M365, activate as standard user.
    if (!user.approved || user.role === "pending") {
      const updated = await pool.query(
        `
        UPDATE users
        SET
          name = COALESCE(NULLIF($1, ''), name),
          role = CASE WHEN role = 'pending' THEN 'user' ELSE role END,
          approved = TRUE
        WHERE id = $2
        RETURNING id, name, email, role, approved
        `,
        [name, user.id]
      );

      return {
        user: updated.rows[0],
        isNew: false,
        wasActivated: true,
      };
    }

    return {
      user,
      isNew: false,
      wasActivated: false,
    };
  }

  const randomPassword = crypto.randomBytes(32).toString("hex");
  const passwordHash = await bcrypt.hash(randomPassword, 10);

  const inserted = await pool.query(
    `
    INSERT INTO users (
      name,
      email,
      password_hash,
      role,
      approved
    )
    VALUES ($1, $2, $3, 'user', TRUE)
    RETURNING id, name, email, role, approved
    `,
    [name, email, passwordHash]
  );

  return {
    user: inserted.rows[0],
    isNew: true,
    wasActivated: true,
  };
}


/**
 * ✅ Helper: Create non-blocking in-app notification
 * If the notifications table has an issue, the main auth flow must not fail.
 */
async function createNotification(message, type = "system") {
  try {
    await pool.query(
      `
      INSERT INTO notifications (message, type, is_read)
      VALUES ($1, $2, false)
      `,
      [message, type]
    );
  } catch (err) {
    console.error("Notification creation failed:", err.message);
  }
}

/**
 * ✅ POST /api/auth/login
 * Logs in approved users only.
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // ✅ Validate request body
  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password required",
    });
  }

  try {
    // ✅ Find user by email
    const { rows } = await pool.query(
      `
      SELECT id, name, email, password_hash, role, approved
      FROM users
      WHERE email = $1
      `,
      [email.toLowerCase()]
    );

    const user = rows[0];

    // ✅ Do not reveal whether email exists
    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    // ✅ Block pending role users
    if (user.role === "pending") {
      return res.status(403).json({
        message: "Your account is pending approval",
      });
    }

    // ✅ Block unapproved users
    // Admin/superadmin exception prevents accidental admin lockout.
    if (!user.approved && !["admin", "superadmin"].includes(user.role)) {
      return res.status(403).json({
        message: "Your account is pending approval",
      });
    }

    // ✅ Validate password
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    // ✅ Generate JWT token
    const token = signToken(user);

    // ✅ Return safe user object
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        approved: user.approved,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      error: "Server error",
    });
  }
});

/**
 * ✅ POST /api/auth/signup
 * Creates a pending account.
 * Does NOT log user in immediately.
 */
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  // ✅ Validate input
  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Name, email and password are required",
    });
  }

  try {
    // ✅ Check duplicate email
    const existing = await pool.query(
      `
      SELECT id
      FROM users
      WHERE email = $1
      `,
      [email.toLowerCase()]
    );

    if (existing.rows[0]) {
      return res.status(409).json({
        error: "User already exists",
      });
    }

    // ✅ Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // ✅ Create user as pending and unapproved
    const { rows } = await pool.query(
      `
      INSERT INTO users (name, email, password_hash, role, approved)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, role, approved, created_at
      `,
      [name.trim(), email.toLowerCase(), passwordHash, "pending", false]
    );

    const newUser = rows[0];

    // ✅ Create in-app notification for admins
    await createNotification(
      `New user signup pending approval: ${newUser.email}`,
      "user_signup"
    );
    //
    console.log("Sending approval email for:", newUser.email);
    console.log("Admin email target:", process.env.ADMIN_EMAIL);
    // ✅ Try sending approval email, but do not break signup if email fails
    try {
      const { sendApprovalEmail } = require("../services/email");

      await sendApprovalEmail({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      });
    } catch (emailErr) {
      console.error(
        "Approval email failed, but signup continues:",
        emailErr.message
      );
    }

    // ✅ Important: do NOT return token here
    return res.status(201).json({
      message:
        "Account created successfully. Please wait for admin approval before signing in.",
      user: newUser,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({
      error: "Server error",
    });
  }
});

/**
 * ✅ POST /api/auth/logout
 * Stateless JWT logout. Frontend removes token.
 */
router.post("/logout", auth, (_req, res) => {
  return res.json({
    ok: true,
  });
});

/**
 * ✅ GET /api/auth/me
 * Returns current authenticated user.
 */
router.get("/me", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT id, name, email, role, approved
      FROM users
      WHERE id = $1
      `,
      [req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    return res.json({
      user: rows[0],
    });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({
      error: "Server error",
    });
  }
});

/**
 * ✅ GET /api/auth/users
 * Admin and superadmin can view all users.
 * Pending users are shown first.
 */
router.get("/users", auth, async (req, res) => {
  // ✅ Only admin and superadmin can view users
  if (!["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({
      error: "Access denied",
    });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT id, name, email, role, approved, created_at
      FROM users
      ORDER BY approved ASC, created_at DESC
      `
    );

    return res.json(rows);
  } catch (err) {
    console.error("Fetch users error:", err);
    return res.status(500).json({
      error: "Failed to fetch users",
    });
  }
});

/**
 * ✅ PUT /api/auth/approve/:id
 * Admin approves a pending user and assigns a role.
 */
router.put("/approve/:id", auth, async (req, res) => {
  const role = req.body.role || req.query.role || "user";

  // ✅ Only admin and superadmin can approve
  if (!["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({
      error: "Access denied",
    });
  }

  // ✅ Allowed roles after approval
  const allowedRoles = [
    "user",
    "agent",
    "operator",
    "manager",
    "admin",
    "superadmin",
  ];

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({
      error: "Invalid role",
    });
  }

  try {
    const { rows } = await pool.query(
      `
      UPDATE users
      SET role = $1,
          approved = TRUE
      WHERE id = $2
      RETURNING id, name, email, role, approved
      `,
      [role, req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // ✅ Create in-app notification
    await createNotification(
      `User approved: ${rows[0].email} as ${rows[0].role}`,
      "user_approved"
    );

    return res.json({
      message: "User approved successfully",
      user: rows[0],
    });
  } catch (err) {
    console.error("Approve error:", err);
    return res.status(500).json({
      error: "Approval failed",
    });
  }
});

/**
 * ✅ DELETE /api/auth/reject/:id
 * Admin rejects and removes a pending user.
 */
router.delete("/reject/:id", auth, async (req, res) => {
  // ✅ Only admin and superadmin can reject users
  if (!["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({
      error: "Access denied",
    });
  }

  try {
    const { rows } = await pool.query(
      `
      DELETE FROM users
      WHERE id = $1
      RETURNING id, email
      `,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // ✅ Create in-app notification
    await createNotification(
      `User rejected and removed: ${rows[0].email}`,
      "user_rejected"
    );

    return res.json({
      message: "User rejected and removed",
      user: rows[0],
    });
  } catch (err) {
    console.error("Reject user error:", err);
    return res.status(500).json({
      error: "Reject failed",
    });
  }
});

/**
 * ✅ Optional backward-compatible reject link
 * This keeps your old GET reject URL working, but protected.
 */
router.get("/reject/:id", auth, async (req, res) => {
  // ✅ Only admin and superadmin can reject users
  if (!["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).send("Access denied");
  }

  try {
    const { rows } = await pool.query(
      `
      DELETE FROM users
      WHERE id = $1
      RETURNING id, email
      `,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).send("User not found");
    }

    await createNotification(
      `User rejected and removed: ${rows[0].email}`,
      "user_rejected"
    );

    return res.send("User rejected and removed");
  } catch (err) {
    console.error("Reject user error:", err);
    return res.status(500).send("Reject failed");
  }
});

/**
 * ✅ GET /api/auth/microsoft
 * Starts Microsoft Entra sign-in.
 *
 * Public URL through Apache:
 * https://portal.atdalliance.co.za/helpdesk/api/auth/microsoft
 */
router.get("/microsoft", async (_req, res) => {
  try {
    const { tenantId, clientId, clientSecret } = getMicrosoftConfig();

    if (!tenantId || !clientId || !clientSecret) {
      return res.status(500).send("Microsoft SSO is not configured.");
    }

    const state = crypto.randomBytes(16).toString("hex");
    const authorizeUrl = buildMicrosoftAuthorizeUrl(state);

    return res.redirect(authorizeUrl);
  } catch (err) {
    console.error("Microsoft auth start error:", err);
    return res.status(500).send("Failed to start Microsoft sign-in.");
  }
});

/**
 * ✅ GET /api/auth/microsoft/callback
 * Microsoft redirects here after successful sign-in.
 *
 * Public callback URL:
 * https://portal.atdalliance.co.za/helpdesk/api/auth/microsoft/callback
 */
router.get("/microsoft/callback", async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    const message = encodeURIComponent(
      error_description || error || "Microsoft sign-in failed."
    );

    return res.redirect(getPortalRedirectUrl(`/login?ssoError=${message}`));
  }

  if (!code) {
    return res.redirect(
      getPortalRedirectUrl(
        `/login?ssoError=${encodeURIComponent("Missing Microsoft auth code.")}`
      )
    );
  }

  try {
    const tokenResponse = await exchangeMicrosoftCodeForToken(code);

    const microsoftProfile = await getMicrosoftMe(tokenResponse.access_token);

    const { user, isNew, wasActivated } =
      await findOrCreateMicrosoftUser(microsoftProfile);

    if (isNew || wasActivated) {
      try {
        await sendM365WelcomeEmail(user);
      } catch (emailErr) {
        console.error(
          "M365 welcome email failed, but login continues:",
          emailErr.message
        );
      }

      await createNotification(
        `Microsoft 365 user registered: ${user.email}`,
        "user_signup"
      );
    }

    const token = signToken(user);

    return res.redirect(
      getPortalRedirectUrl(`/login?token=${encodeURIComponent(token)}`)
    );
  } catch (err) {
    console.error("Microsoft callback error:", err);

    const status = err.status || 500;
    const message = encodeURIComponent(
      err.message || "Microsoft sign-in failed."
    );

    if (status === 403) {
      return res.redirect(getPortalRedirectUrl(`/login?ssoError=${message}`));
    }

    return res.redirect(
      getPortalRedirectUrl(
        `/login?ssoError=${encodeURIComponent("Microsoft sign-in failed.")}`
      )
    );
  }
});

module.exports = router;