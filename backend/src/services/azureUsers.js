const axios = require("axios");

let tokenCache = { accessToken: null, expiresAt: 0 };
const TOKEN_EARLY_EXPIRY_MS = 5 * 60 * 1000;

function getAzureConfig() {
  return {
    tenantId: process.env.MICROSOFT_TENANT_ID || process.env.AZURE_TENANT_ID,
    clientId: process.env.MICROSOFT_CLIENT_ID || process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET,
    allowedDomain: String(process.env.MICROSOFT_ALLOWED_DOMAIN || "atdalliance.co.za").trim().toLowerCase(),
  };
}

async function getAccessToken() {
  const { tenantId, clientId, clientSecret } = getAzureConfig();
  if (!tenantId || !clientId || !clientSecret) throw new Error("Microsoft Graph application credentials are not configured.");

  if (tokenCache.accessToken && tokenCache.expiresAt > Date.now() + TOKEN_EARLY_EXPIRY_MS) return tokenCache.accessToken;

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await axios.post(tokenUrl, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 20000,
  });

  tokenCache = {
    accessToken: response.data.access_token,
    expiresAt: Date.now() + (Number(response.data.expires_in) || 3600) * 1000,
  };
  return tokenCache.accessToken;
}

function getPrimaryEmail(user) {
  return String(user.mail || user.userPrincipalName || "").trim().toLowerCase();
}

function isCompanyUser(user, allowedDomain) {
  const email = getPrimaryEmail(user);
  return Boolean(email && email.endsWith(`@${allowedDomain}`));
}

function inferAccountType(user) {
  const email = getPrimaryEmail(user);
  const local = (email.split("@")[0] || "").toLowerCase();
  const name = String(user.displayName || "").toLowerCase();
  // Whole tokens only — substring matches like "bot" inside "Botipe" / "Sebothoma"
  // previously marked real employees as service accounts.
  const tokens = `${local.replace(/[._+-]+/g, " ")} ${name}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  if (user.userType === "Guest") return "external";

  if (
    /^(info|support|sales|accounts|reception|helpdesk|itsupport)([.+_-]|$)/i.test(local) ||
    tokens.some((token) => ["shared", "mailbox", "reception", "helpdesk", "itsupport"].includes(token))
  ) {
    return "shared";
  }

  if (
    /^(noreply|no-reply|svc|service|automation|system\d*)([.+_-]|$)/i.test(local) ||
    /\.adm$/i.test(local) ||
    tokens.some((token) =>
      ["service", "svc", "automation", "bot", "noreply", "adm", "admin", "system"].includes(token) ||
      /^system\d+$/.test(token)
    )
  ) {
    return "service";
  }

  return "person";
}

async function getUsers(options = {}) {
  const { includeGuests = false, includeDisabled = true } = options;
  const token = await getAccessToken();
  const { allowedDomain } = getAzureConfig();
  const users = [];

  let nextUrl = "https://graph.microsoft.com/v1.0/users" +
    "?$top=999&$select=" + [
      "id","displayName","givenName","surname","mail","userPrincipalName",
      "jobTitle","department","officeLocation","mobilePhone","businessPhones",
      "accountEnabled","userType","createdDateTime"
    ].join(",");

  while (nextUrl) {
    const response = await axios.get(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000,
    });
    users.push(...(Array.isArray(response.data.value) ? response.data.value : []));
    nextUrl = response.data["@odata.nextLink"] || null;
  }

  return users
    .filter((user) => includeGuests || user.userType !== "Guest")
    .filter((user) => includeDisabled || user.accountEnabled !== false)
    .filter((user) => isCompanyUser(user, allowedDomain))
    .map((user) => ({
      microsoftId: user.id,
      name: user.displayName || getPrimaryEmail(user),
      firstName: user.givenName || "",
      lastName: user.surname || "",
      email: getPrimaryEmail(user),
      jobTitle: user.jobTitle || "",
      department: user.department || "",
      officeLocation: user.officeLocation || "",
      mobilePhone: user.mobilePhone || "",
      businessPhone: Array.isArray(user.businessPhones) ? user.businessPhones[0] || "" : "",
      accountEnabled: user.accountEnabled !== false,
      userType: user.userType || "Member",
      microsoftCreatedAt: user.createdDateTime || null,
      accountType: inferAccountType(user),
    }));
}

module.exports = { getAccessToken, getUsers, getPrimaryEmail, inferAccountType };
