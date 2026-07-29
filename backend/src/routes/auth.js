const router = require("express").Router();

const axios = require("axios");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const {
  sendApprovalEmail,
  sendM365WelcomeEmail,
} = require("../services/email");

const ALLOWED_ROLES = [
  "user",
  "agent",
  "operator",
  "manager",
  "admin",
  "superadmin",
];

const SAFE_USER_SELECT = `
  id,
  name,
  email,
  role,
  status,
  approved,
  microsoft_id,
  microsoft_account_enabled,
  microsoft_user_type,
  employee_number,
  job_title,
  department,
  office_location,
  site,
  archived_at,
  last_login_at,
  created_at,
  updated_at
`;

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function getEmailDomain(email) {
  return normalizeEmail(email).split("@")[1] || "";
}

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
    process.env.MICROSOFT_TENANT_ID ||
    process.env.AZURE_TENANT_ID;

  const clientId =
    process.env.MICROSOFT_CLIENT_ID ||
    process.env.AZURE_CLIENT_ID;

  const clientSecret =
    process.env.MICROSOFT_CLIENT_SECRET ||
    process.env.AZURE_CLIENT_SECRET;

  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI ||
    "http://localhost:3001/api/auth/microsoft/callback";

  const allowedDomain = String(
    process.env.MICROSOFT_ALLOWED_DOMAIN ||
      "atdalliance.co.za"
  ).toLowerCase();

  const autoApprove =
    process.env.MICROSOFT_AUTO_APPROVE !== "false";

  return {
    tenantId,
    clientId,
    clientSecret,
    redirectUri,
    allowedDomain,
    autoApprove,
  };
}

function getPortalBaseUrl() {
  const configuredUrl =
    process.env.PUBLIC_PORTAL_URL ||
    "http://localhost:5173/helpdesk";

  return configuredUrl
    .replace(/\/login\/?$/i, "")
    .replace(/\/$/, "");
}

function getPortalRedirectUrl(path = "/") {
  const normalizedPath = path.startsWith("/")
    ? path
    : `/${path}`;

  return `${getPortalBaseUrl()}${normalizedPath}`;
}

function buildMicrosoftAuthorizeUrl(state) {
  const {
    tenantId,
    clientId,
    redirectUri,
  } = getMicrosoftConfig();

  const parameters = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: "openid profile email User.Read",
    state,
    prompt: "select_account",
  });

  return (
    `https://login.microsoftonline.com/${tenantId}` +
    `/oauth2/v2.0/authorize?${parameters.toString()}`
  );
}

async function exchangeMicrosoftCodeForToken(code) {
  const {
    tenantId,
    clientId,
    clientSecret,
    redirectUri,
  } = getMicrosoftConfig();

  const tokenUrl =
    `https://login.microsoftonline.com/${tenantId}` +
    "/oauth2/v2.0/token";

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: "openid profile email User.Read",
  });

  const response = await axios.post(tokenUrl, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: 20000,
  });

  return response.data;
}

async function getMicrosoftProfile(accessToken) {
  const response = await axios.get(
    "https://graph.microsoft.com/v1.0/me" +
      "?$select=id,displayName,mail,userPrincipalName," +
      "givenName,surname,jobTitle,department,officeLocation," +
      "mobilePhone,businessPhones,accountEnabled,userType",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 20000,
    }
  );

  return response.data;
}

async function getCurrentUser(userId) {
  const result = await pool.query(
    `
    SELECT ${SAFE_USER_SELECT}
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function findOrCreateMicrosoftUser(profile) {
  const email = normalizeEmail(
    profile.mail || profile.userPrincipalName
  );

  const name = String(
    profile.displayName || email
  ).trim();

  const {
    allowedDomain,
    autoApprove,
  } = getMicrosoftConfig();

  if (!email) {
    const error = new Error(
      "Microsoft account did not return an email address."
    );
    error.status = 400;
    throw error;
  }

  if (getEmailDomain(email) !== allowedDomain) {
    const error = new Error(
      `Only @${allowedDomain} Microsoft accounts are allowed.`
    );
    error.status = 403;
    throw error;
  }

  const microsoftAccountEnabled =
    profile.accountEnabled !== false;

  if (!microsoftAccountEnabled) {
    const error = new Error(
      "This Microsoft account is disabled."
    );
    error.status = 403;
    throw error;
  }

  const existingResult = await pool.query(
    `
    SELECT ${SAFE_USER_SELECT}
    FROM users
    WHERE
      microsoft_id = $1
      OR LOWER(email::text) = LOWER($2::text)
    ORDER BY
      CASE WHEN microsoft_id = $1 THEN 0 ELSE 1 END,
      id
    LIMIT 1
    `,
    [profile.id, email]
  );

  if (existingResult.rows[0]) {
    const existingUser = existingResult.rows[0];

    if (existingUser.archived_at) {
      const error = new Error(
        "This portal account is archived. Contact an administrator."
      );
      error.status = 403;
      throw error;
    }

    const updatedResult = await pool.query(
      `
      UPDATE users
      SET
        name = COALESCE(NULLIF($1, ''), name),
        email = $2,
        microsoft_id = $3,
        first_name = COALESCE(NULLIF($4, ''), first_name),
        last_name = COALESCE(NULLIF($5, ''), last_name),
        job_title = COALESCE(NULLIF($6, ''), job_title),
        department = COALESCE(NULLIF($7, ''), department),
        office_location = COALESCE(NULLIF($8, ''), office_location),
        mobile_phone = COALESCE(NULLIF($9, ''), mobile_phone),
        business_phone = COALESCE(NULLIF($10, ''), business_phone),
        microsoft_account_enabled = $11,
        microsoft_user_type = $12,
        approved = CASE
          WHEN $13 = TRUE THEN TRUE
          ELSE approved
        END,
        status = CASE
          WHEN $13 = TRUE THEN 'active'
          ELSE status
        END,
        role = CASE
          WHEN role = 'pending' THEN 'user'
          ELSE role
        END,
        last_microsoft_sync_at = NOW(),
        microsoft_sync_status = 'success',
        last_login_at = NOW(),
        updated_at = NOW()
      WHERE id = $14
      RETURNING ${SAFE_USER_SELECT}
      `,
      [
        name,
        email,
        profile.id,
        profile.givenName || null,
        profile.surname || null,
        profile.jobTitle || null,
        profile.department || null,
        profile.officeLocation || null,
        profile.mobilePhone || null,
        profile.businessPhones?.[0] || null,
        microsoftAccountEnabled,
        profile.userType || null,
        autoApprove,
        existingUser.id,
      ]
    );

    return {
      user: updatedResult.rows[0],
      isNew: false,
      wasActivated:
        !existingUser.approved ||
        existingUser.status !== "active",
    };
  }

  const randomPassword = crypto
    .randomBytes(32)
    .toString("hex");

  const passwordHash = await bcrypt.hash(
    randomPassword,
    10
  );

  const approved = autoApprove;
  const status = approved ? "active" : "inactive";

  const insertedResult = await pool.query(
    `
    INSERT INTO users (
      name,
      email,
      password_hash,
      role,
      status,
      approved,
      microsoft_id,
      first_name,
      last_name,
      job_title,
      department,
      office_location,
      mobile_phone,
      business_phone,
      microsoft_account_enabled,
      microsoft_user_type,
      last_microsoft_sync_at,
      microsoft_sync_status,
      last_login_at
    )
    VALUES (
      $1,
      $2,
      $3,
      'user',
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12,
      $13,
      $14,
      $15,
      NOW(),
      'success',
      NOW()
    )
    RETURNING ${SAFE_USER_SELECT}
    `,
    [
      name,
      email,
      passwordHash,
      status,
      approved,
      profile.id,
      profile.givenName || null,
      profile.surname || null,
      profile.jobTitle || null,
      profile.department || null,
      profile.officeLocation || null,
      profile.mobilePhone || null,
      profile.businessPhones?.[0] || null,
      microsoftAccountEnabled,
      profile.userType || null,
    ]
  );

  return {
    user: insertedResult.rows[0],
    isNew: true,
    wasActivated: approved,
  };
}

async function createNotification(
  message,
  type = "system",
  targetRole = null
) {
  try {
    await pool.query(
      `
      INSERT INTO notifications (
        user_id,
        target_role,
        message,
        type,
        module,
        is_read,
        created_at
      )
      VALUES (
        NULL,
        $1,
        $2,
        $3,
        'admin',
        FALSE,
        NOW()
      )
      `,
      [targetRole, message, type]
    );
  } catch (error) {
    console.error(
      "Authentication notification creation failed:",
      error.message
    );
  }
}

router.post("/login", async (request, response) => {
  const email = normalizeEmail(request.body.email);
  const password = String(request.body.password || "");

  if (!email || !password) {
    return response.status(400).json({
      error: "Email and password are required",
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        ${SAFE_USER_SELECT},
        password_hash
      FROM users
      WHERE LOWER(email::text) = LOWER($1::text)
      LIMIT 1
      `,
      [email]
    );

    const user = result.rows[0];

    if (!user || !user.password_hash) {
      return response.status(401).json({
        error: "Invalid credentials",
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!validPassword) {
      return response.status(401).json({
        error: "Invalid credentials",
      });
    }

    if (user.archived_at) {
      return response.status(403).json({
        message: "This account has been archived.",
      });
    }

    if (!user.approved || user.status !== "active") {
      return response.status(403).json({
        message: "Your account is still awaiting administrator approval.",
      });
    }

    if (user.microsoft_account_enabled === false) {
      return response.status(403).json({
        message: "The linked Microsoft account is disabled.",
      });
    }

    await pool.query(
      `
      UPDATE users
      SET last_login_at = NOW()
      WHERE id = $1
      `,
      [user.id]
    );

    const token = signToken(user);

    delete user.password_hash;

    return response.json({
      token,
      user,
    });
  } catch (error) {
    console.error("Login failed:", error);
    return response.status(500).json({
      error: "Login failed",
    });
  }
});

router.post("/signup", async (request, response) => {
  const name = String(request.body.name || "").trim();
  const email = normalizeEmail(request.body.email);
  const password = String(request.body.password || "");

  if (!name || !email || !password) {
    return response.status(400).json({
      error: "Name, email and password are required",
    });
  }

  try {
    const existingResult = await pool.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(email::text) = LOWER($1::text)
      LIMIT 1
      `,
      [email]
    );

    if (existingResult.rows[0]) {
      return response.status(409).json({
        error: "User already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const insertedResult = await pool.query(
      `
      INSERT INTO users (
        name,
        email,
        password_hash,
        role,
        status,
        approved
      )
      VALUES (
        $1,
        $2,
        $3,
        'pending',
        'inactive',
        FALSE
      )
      RETURNING ${SAFE_USER_SELECT}
      `,
      [name, email, passwordHash]
    );

    const newUser = insertedResult.rows[0];

    await createNotification(
      `New local user signup pending approval: ${newUser.email}`,
      "user_signup",
      "admin"
    );

    sendApprovalEmail(newUser).catch((emailError) => {
      console.error(
        "Approval email failed, but signup continues:",
        emailError.message
      );
    });

    return response.status(201).json({
      message:
        "Account created successfully. Please wait for administrator approval before signing in.",
      user: newUser,
    });
  } catch (error) {
    console.error("Signup failed:", error);
    return response.status(500).json({
      error: "Signup failed",
    });
  }
});

router.post("/logout", auth, (_request, response) => {
  return response.json({ ok: true });
});

router.get("/me", auth, async (request, response) => {
  try {
    const currentUser = await getCurrentUser(request.user.id);

    if (!currentUser) {
      return response.status(401).json({
        error: "The account no longer exists.",
      });
    }

    return response.json({
      user: currentUser,
    });
  } catch (error) {
    console.error("Fetch current user failed:", error);
    return response.status(500).json({
      error: "Failed to load the current account.",
    });
  }
});

router.get("/users", auth, async (request, response) => {
  if (!["admin", "superadmin"].includes(request.user.role)) {
    return response.status(403).json({
      error: "Access denied",
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT ${SAFE_USER_SELECT}
      FROM users
      ORDER BY
        approved ASC,
        archived_at NULLS FIRST,
        created_at DESC
      `
    );

    return response.json(result.rows);
  } catch (error) {
    console.error("Fetch authentication users failed:", error);
    return response.status(500).json({
      error: "Failed to fetch users",
    });
  }
});

router.put("/approve/:id", auth, async (request, response) => {
  if (!["admin", "superadmin"].includes(request.user.role)) {
    return response.status(403).json({
      error: "Access denied",
    });
  }

  const role = String(
    request.body.role || request.query.role || "user"
  ).toLowerCase();

  if (!ALLOWED_ROLES.includes(role)) {
    return response.status(400).json({
      error: "Invalid role",
    });
  }

  if (
    ["admin", "superadmin"].includes(role) &&
    request.user.role !== "superadmin"
  ) {
    return response.status(403).json({
      error: "Only a superadmin can assign protected roles.",
    });
  }

  try {
    const result = await pool.query(
      `
      UPDATE users
      SET
        role = $1,
        approved = TRUE,
        status = 'active',
        archived_at = NULL,
        archived_by = NULL,
        archive_reason = NULL,
        updated_at = NOW()
      WHERE id = $2
      RETURNING ${SAFE_USER_SELECT}
      `,
      [role, request.params.id]
    );

    if (!result.rows[0]) {
      return response.status(404).json({
        error: "User not found",
      });
    }

    return response.json({
      message: "User approved successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Approve user failed:", error);
    return response.status(500).json({
      error: "Approval failed",
    });
  }
});

router.delete("/reject/:id", auth, async (request, response) => {
  if (!["admin", "superadmin"].includes(request.user.role)) {
    return response.status(403).json({
      error: "Access denied",
    });
  }

  try {
    const result = await pool.query(
      `
      DELETE FROM users
      WHERE id = $1
        AND approved = FALSE
      RETURNING id, email
      `,
      [request.params.id]
    );

    if (!result.rows[0]) {
      return response.status(404).json({
        error: "Pending user not found",
      });
    }

    return response.json({
      message: "Pending user rejected and removed",
      user: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23503") {
      return response.status(409).json({
        error:
          "This account has linked records and cannot be removed. Archive it instead.",
      });
    }

    console.error("Reject user failed:", error);
    return response.status(500).json({
      error: "Reject failed",
    });
  }
});

router.get("/microsoft", async (_request, response) => {
  try {
    const {
      tenantId,
      clientId,
      clientSecret,
    } = getMicrosoftConfig();

    if (!tenantId || !clientId || !clientSecret) {
      return response.status(500).send(
        "Microsoft SSO is not configured."
      );
    }

    const state = crypto.randomBytes(16).toString("hex");
    return response.redirect(
      buildMicrosoftAuthorizeUrl(state)
    );
  } catch (error) {
    console.error("Start Microsoft sign-in failed:", error);
    return response.status(500).send(
      "Failed to start Microsoft sign-in."
    );
  }
});

router.get("/microsoft/callback", async (request, response) => {
  const {
    code,
    error,
    error_description: errorDescription,
  } = request.query;

  if (error) {
    const message = encodeURIComponent(
      errorDescription || error || "Microsoft sign-in failed."
    );

    return response.redirect(
      getPortalRedirectUrl(`/login?ssoError=${message}`)
    );
  }

  if (!code) {
    return response.redirect(
      getPortalRedirectUrl(
        `/login?ssoError=${encodeURIComponent(
          "Missing Microsoft authorisation code."
        )}`
      )
    );
  }

  try {
    const tokenResponse =
      await exchangeMicrosoftCodeForToken(code);

    const microsoftProfile =
      await getMicrosoftProfile(tokenResponse.access_token);

    const {
      user,
      isNew,
      wasActivated,
    } = await findOrCreateMicrosoftUser(microsoftProfile);

    if (isNew || wasActivated) {
      sendM365WelcomeEmail(user).catch((emailError) => {
        console.error(
          "Microsoft welcome email failed, but login continues:",
          emailError.message
        );
      });
    }

    const currentUser = await getCurrentUser(user.id);
    const token = signToken(currentUser);

    return response.redirect(
      getPortalRedirectUrl(
        `/login?token=${encodeURIComponent(token)}`
      )
    );
  } catch (callbackError) {
    console.error("Microsoft callback failed:", {
      message: callbackError.message,
      status: callbackError.status || 500,
    });

    const message = encodeURIComponent(
      callbackError.status === 403
        ? callbackError.message
        : "Microsoft sign-in failed."
    );

    return response.redirect(
      getPortalRedirectUrl(`/login?ssoError=${message}`)
    );
  }
});

module.exports = router;
