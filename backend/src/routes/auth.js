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
  username,
  role,
  status,
  account_type,
  authentication_mode,
  account_purpose,
  deactivated_at,
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

  const localPasswordAccount = Boolean(
    user.role === "superadmin" ||
      user.account_purpose === "superadmin" ||
      user.account_purpose === "station_operator" ||
      user.authentication_mode === "local_password"
  );
  if (user.microsoft_account_enabled === false && !localPasswordAccount) {
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


function normalizeIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}

function unavailableRoute(message) {
  return {
    route: "unavailable",
    passwordAllowed: false,
    microsoftAllowed: false,
    preferred: null,
    options: [],
    message,
  };
}

function activeInteractiveAccount(user) {
  return Boolean(
    user &&
      user.approved &&
      user.role !== "pending" &&
      user.status === "active" &&
      !user.archived_at &&
      !user.deactivated_at &&
      (user.account_type || "person") === "person"
  );
}

async function authenticationPolicyFor(user) {
  let policy = null;
  try {
    const result = await pool.query(
      `SELECT allow_microsoft_sso, allow_local_password, preferred_method, policy_reason
       FROM user_authentication_policies
       WHERE user_id = $1`,
      [user.id]
    );
    policy = result.rows[0] || null;
  } catch (error) {
    if (error.code !== "42P01") throw error;
  }

  const companyAccount = getEmailDomain(user.email) === getMicrosoftConfig().allowedDomain;
  const superadmin = user.role === "superadmin" || user.account_purpose === "superadmin";
  const station = user.account_purpose === "station_operator";
  const hasPassword = Boolean(user.password_hash);
  const microsoftIdentityAvailable = Boolean(
    companyAccount && user.email && user.microsoft_account_enabled !== false
  );

  if (policy) {
    return {
      companyAccount,
      passwordAllowed: Boolean(policy.allow_local_password && hasPassword),
      microsoftAllowed: Boolean(policy.allow_microsoft_sso && microsoftIdentityAvailable),
      preferred: policy.preferred_method,
      source: "governed_policy",
    };
  }
  if (superadmin) {
    return {
      companyAccount,
      passwordAllowed: hasPassword,
      microsoftAllowed: microsoftIdentityAvailable,
      preferred: hasPassword ? "local_password" : "microsoft",
      source: "superadmin_policy",
    };
  }
  if (station) {
    return {
      companyAccount: false,
      passwordAllowed: hasPassword,
      microsoftAllowed: false,
      preferred: "local_password",
      source: "station_policy",
    };
  }
  if (companyAccount) {
    return {
      companyAccount: true,
      passwordAllowed: false,
      microsoftAllowed: microsoftIdentityAvailable,
      preferred: "microsoft",
      source: "company_policy",
    };
  }
  return {
    companyAccount: false,
    passwordAllowed: hasPassword,
    microsoftAllowed: false,
    preferred: "local_password",
    source: "external_local_policy",
  };
}

router.post("/login-options", async (request, response) => {
  const identifier = normalizeIdentifier(request.body.identifier || request.body.email);
  if (!identifier) {
    return response.status(400).json({
      code: "IDENTIFIER_REQUIRED",
      error: "Enter a username or email address.",
    });
  }
  try {
    const result = await pool.query(
      `SELECT id,email,username,role,status,approved,archived_at,deactivated_at,
              account_type,password_hash,microsoft_account_enabled,authentication_mode,account_purpose
       FROM users
       WHERE LOWER(COALESCE(email,''))=$1 OR LOWER(COALESCE(username,''))=$1
       LIMIT 1`,
      [identifier]
    );
    const user = result.rows[0];
    if (!activeInteractiveAccount(user)) {
      return response.json(unavailableRoute(
        "No active sign-in account is available for this identifier. Use another account or submit a local account request."
      ));
    }
    const policy = await authenticationPolicyFor(user);
    const options = [];
    if (policy.microsoftAllowed) options.push("microsoft");
    if (policy.passwordAllowed) options.push("local_password");
    if (!options.length) {
      return response.json(unavailableRoute(
        policy.companyAccount
          ? "Microsoft sign-in is not available for this company account. Contact IT for assistance."
          : "No active local password is registered for this account. Submit a local account request or contact IT."
      ));
    }
    return response.json({
      route: options.length > 1 ? "options" : options[0] === "microsoft" ? "microsoft" : "password",
      passwordAllowed: policy.passwordAllowed,
      microsoftAllowed: policy.microsoftAllowed,
      preferred: options.includes(policy.preferred) ? policy.preferred : options[0],
      options,
      loginHint: policy.microsoftAllowed ? user.email : null,
      identifierType: policy.companyAccount ? "company" : user.account_purpose === "station_operator" ? "station_operator" : "local",
      policySource: policy.source,
    });
  } catch (error) {
    console.error("Login routing failed:", error);
    return response.status(500).json({ error: "Sign-in routing could not be completed." });
  }
});

router.post("/login", async (request, response) => {
  const identifier = normalizeIdentifier(request.body.identifier || request.body.email);
  const password = String(request.body.password || "");
  if (!identifier || !password) {
    return response.status(400).json({ error: "Username/email and password are required" });
  }
  try {
    const result = await pool.query(
      `SELECT ${SAFE_USER_SELECT},password_hash FROM users
       WHERE LOWER(COALESCE(email,''))=$1 OR LOWER(COALESCE(username,''))=$1 LIMIT 1`,
      [identifier]
    );
    const user = result.rows[0];
    if (!user || !user.password_hash || !activeInteractiveAccount(user)) {
      return response.status(401).json({ error: "Invalid credentials" });
    }
    const policy = await authenticationPolicyFor(user);
    if (!policy.passwordAllowed) {
      return response.status(403).json({
        code: "PASSWORD_LOGIN_NOT_ALLOWED",
        error: policy.companyAccount
          ? "Use Microsoft to sign in with this company account."
          : "Password sign-in is not enabled for this account.",
      });
    }
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return response.status(401).json({ error: "Invalid credentials" });
    }
    const accessError = buildAccountAccessError(user);
    if (accessError) {
      return response.status(accessError.status).json({ code: accessError.code, message: accessError.message });
    }
    await pool.query("UPDATE users SET last_login_at=NOW() WHERE id=$1", [user.id]);
    const token = signToken(user);
    delete user.password_hash;
    return response.json({ token, user: { ...user, last_login_at: new Date() } });
  } catch (error) {
    console.error("Login failed:", { message: error.message, code: error.code || null });
    return response.status(500).json({
      code: "LOCAL_LOGIN_REQUEST_FAILED",
      error: process.env.NODE_ENV === "development" ? `Local login failed: ${error.message}` : "Login failed",
    });
  }
});
router.post("/signup",async(request,response)=>{
 const name=String(request.body.name||"").trim();const username=normalizeIdentifier(request.body.username);const email=normalizeEmail(request.body.email);const password=String(request.body.password||"");const accountPurpose=String(request.body.accountPurpose||"external_local");
 const station=accountPurpose==="station_operator";const plantCode=String(request.body.plantCode||"").trim();const stationCode=String(request.body.stationCode||"").trim();
 if(!name||!password||(!station&&!email)||(station&&(!username||!plantCode||!stationCode)))return response.status(400).json({error:station?"Name, username, plant, station and password are required":"Name, email and password are required"});
 if(email&&getEmailDomain(email)===getMicrosoftConfig().allowedDomain)return response.status(409).json({code:"COMPANY_SSO_REQUIRED",error:"Company email accounts must use Microsoft SSO."});
 if(username&&!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username))return response.status(400).json({error:"Username must be 3 to 40 characters using letters, numbers, dots, underscores or hyphens."});
 if(password.length<8)return response.status(400).json({error:"Password must be at least 8 characters."});
 try{
  const exists=await pool.query("SELECT id FROM users WHERE ($1<>'' AND LOWER(COALESCE(email,''))=$1) OR ($2<>'' AND LOWER(COALESCE(username,''))=$2) LIMIT 1",[email,username]);if(exists.rowCount)return response.status(409).json({error:"An account already exists for this identifier."});
  const hash=await bcrypt.hash(password,10);const fallbackEmail=station?null:email;
  const inserted=await pool.query(`INSERT INTO users(name,email,username,password_hash,role,status,approved,authentication_mode,account_purpose,plant_code,station_code,shift_code,station_signup_requested_at)
   VALUES($1,$2,$3,$4,'pending','inactive',FALSE,'local_password',$5,$6,$7,$8,CASE WHEN $5='station_operator' THEN NOW() ELSE NULL END) RETURNING ${SAFE_USER_SELECT}`,[name,fallbackEmail,username||null,hash,station?"station_operator":"external_local",plantCode||null,stationCode||null,String(request.body.shiftCode||"").trim()||null]);
  const user=inserted.rows[0];try{await createAccountApprovalNotifications(user)}catch(e){console.error("Approval notification failed:",e.message)}
  return response.status(201).json({message:station?"Station operator account request submitted for approval.":"Account request submitted for approval.",user});
 }catch(error){if(error.code==="23505")return response.status(409).json({error:"An account already exists for this identifier."});console.error("Signup failed:",error);return response.status(500).json({error:"Signup failed"});}
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
