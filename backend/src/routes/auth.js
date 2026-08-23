const router = require("express").Router();

const axios = require("axios");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const pool = require("../db/pool");
const auth = require("../middleware/auth");
const {
  sendApprovalEmail,
  sendAccountRequestReceivedEmail,
  sendM365WelcomeEmail,
} = require("../services/email");
const {
  createAccountApprovalNotifications,
} = require("../services/notificationService");

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

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function signToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

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
  )
    .trim()
    .toLowerCase();

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

  const response = await axios.post(
    tokenUrl,
    body.toString(),
    {
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      timeout: 20000,
    }
  );

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

function buildAccountAccessError(user) {
  if (!user) {
    return {
      status: 401,
      code: "ACCOUNT_NOT_FOUND",
      message: "The account no longer exists.",
    };
  }

  if (user.archived_at) {
    return {
      status: 403,
      code: "ACCOUNT_ARCHIVED",
      message:
        "This account has been archived. Please contact IT for assistance.",
    };
  }

  if (!user.approved || user.role === "pending") {
    return {
      status: 403,
      code: "ACCOUNT_PENDING",
      message:
        "Your account is still awaiting administrator approval.",
    };
  }

  if (user.status !== "active") {
    return {
      status: 403,
      code: "ACCOUNT_DEACTIVATED",
      message:
        "This account is currently deactivated. Please contact IT for assistance.",
    };
  }

  if (user.microsoft_account_enabled === false) {
    return {
      status: 403,
      code: "MICROSOFT_ACCOUNT_DISABLED",
      message:
        "The linked Microsoft account is disabled. Please contact IT for assistance.",
    };
  }

  return null;
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
      `Only @${allowedDomain} Microsoft accounts are allowed. ` +
        "If you do not have a company Microsoft 365 account, create a local account or contact IT for assistance."
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

    // A verified company SSO can activate a genuinely pending registration.
    // It must not silently reactivate an approved account that an admin deactivated.
    const shouldActivatePendingAccount = Boolean(
      autoApprove &&
        (!existingUser.approved || existingUser.role === "pending")
    );

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
          WHEN $13 = TRUE AND role = 'pending' THEN 'user'
          ELSE role
        END,
        last_microsoft_sync_at = NOW(),
        microsoft_sync_status = 'success',
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
        shouldActivatePendingAccount,
        existingUser.id,
      ]
    );

    const updatedUser = updatedResult.rows[0];
    const accessError = buildAccountAccessError(updatedUser);

    if (accessError) {
      const error = new Error(accessError.message);
      error.status = accessError.status;
      error.code = accessError.code;
      throw error;
    }

    await pool.query(
      `
      UPDATE users
      SET last_login_at = NOW()
      WHERE id = $1
      `,
      [updatedUser.id]
    );

    return {
      user: {
        ...updatedUser,
        last_login_at: new Date(),
      },
      isNew: false,
      wasActivated: shouldActivatePendingAccount,
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

    const accessError = buildAccountAccessError(user);

    if (accessError) {
      return response
        .status(accessError.status)
        .json({
          code: accessError.code,
          message: accessError.message,
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
      user: {
        ...user,
        last_login_at: new Date(),
      },
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

  if (!isValidEmail(email)) {
    return response.status(400).json({
      error: "Enter a valid email address.",
    });
  }

  if (password.length < 8) {
    return response.status(400).json({
      error: "Password must be at least 8 characters.",
    });
  }

  try {
    const existingResult = await pool.query(
      `
      SELECT id, approved, status, archived_at
      FROM users
      WHERE LOWER(email::text) = LOWER($1::text)
      LIMIT 1
      `,
      [email]
    );

    if (existingResult.rows[0]) {
      return response.status(409).json({
        error:
          "An account already exists for this email address. Use Sign In or contact IT for assistance.",
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

    try {
      await createAccountApprovalNotifications(newUser);
    } catch (notificationError) {
      console.error(
        "Account approval notifications failed, but signup continues:",
        {
          userId: newUser.id,
          message: notificationError.message,
        }
      );
    }

    // Email is intentionally non-blocking. The account request is already saved.
    Promise.allSettled([
      sendApprovalEmail(newUser),
      sendAccountRequestReceivedEmail(newUser),
    ]).then((results) => {
      const labels = [
        "Administrator approval email",
        "Requester confirmation email",
      ];

      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(
            `${labels[index]} failed, but signup continues:`,
            result.reason?.message || result.reason
          );
          return;
        }

        if (
          result.value &&
          !result.value.sent &&
          !result.value.skipped
        ) {
          console.error(
            `${labels[index]} was not delivered:`,
            result.value.error || result.value
          );
        }
      });
    });

    return response.status(201).json({
      message:
        "Account request submitted successfully. Administrators and authorised IT staff have been notified.",
      user: newUser,
    });
  } catch (error) {
    if (error.code === "23505") {
      return response.status(409).json({
        error: "An account already exists for this email address.",
      });
    }

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

// Backward-compatible administrative list. The primary administration API is /api/users.
router.get("/users", auth, async (request, response) => {
  if (![
    "manager",
    "admin",
    "superadmin",
  ].includes(request.user.role)) {
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
        CASE
          WHEN role = 'pending' AND approved = FALSE THEN 1
          WHEN archived_at IS NULL AND approved = TRUE AND status = 'active' THEN 2
          WHEN archived_at IS NULL AND approved = TRUE AND status = 'inactive' THEN 3
          ELSE 4
        END,
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
  if (![
    "admin",
    "superadmin",
  ].includes(request.user.role)) {
    return response.status(403).json({
      error: "Access denied",
    });
  }

  const role = String(
    request.body.role ||
      request.query.role ||
      "user"
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
      error:
        "Only a superadmin can assign protected roles.",
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
        updated_at = NOW()
      WHERE id = $2
        AND archived_at IS NULL
      RETURNING ${SAFE_USER_SELECT}
      `,
      [role, request.params.id]
    );

    if (!result.rows[0]) {
      return response.status(404).json({
        error:
          "Pending user not found, or the account is archived.",
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
  if (![
    "admin",
    "superadmin",
  ].includes(request.user.role)) {
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
        AND role = 'pending'
        AND archived_at IS NULL
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
      errorDescription ||
        error ||
        "Microsoft sign-in failed."
    );

    return response.redirect(
      getPortalRedirectUrl(
        `/login?ssoError=${message}`
      )
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
      await getMicrosoftProfile(
        tokenResponse.access_token
      );

    const {
      user,
      isNew,
      wasActivated,
    } = await findOrCreateMicrosoftUser(
      microsoftProfile
    );

    if (isNew || wasActivated) {
      sendM365WelcomeEmail(user).catch(
        (emailError) => {
          console.error(
            "Microsoft welcome email failed, but login continues:",
            emailError.message
          );
        }
      );
    }

    const currentUser = await getCurrentUser(user.id);
    const accessError = buildAccountAccessError(currentUser);

    if (accessError) {
      const message = encodeURIComponent(
        accessError.message
      );
      return response.redirect(
        getPortalRedirectUrl(
          `/login?ssoError=${message}`
        )
      );
    }

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
      code: callbackError.code || null,
    });

    const message = encodeURIComponent(
      callbackError.status === 403
        ? callbackError.message
        : "Microsoft sign-in failed."
    );

    return response.redirect(
      getPortalRedirectUrl(
        `/login?ssoError=${message}`
      )
    );
  }
});

module.exports = router;
