const axios = require("axios");

function getAzureConfig() {
  return {
    tenantId:
      process.env.MICROSOFT_TENANT_ID ||
      process.env.AZURE_TENANT_ID,

    clientId:
      process.env.MICROSOFT_CLIENT_ID ||
      process.env.AZURE_CLIENT_ID,

    clientSecret:
      process.env.MICROSOFT_CLIENT_SECRET ||
      process.env.AZURE_CLIENT_SECRET,

    allowedDomain:
      process.env.MICROSOFT_ALLOWED_DOMAIN ||
      "atdalliance.co.za",
  };
}

async function getAccessToken() {
  const {
    tenantId,
    clientId,
    clientSecret,
  } = getAzureConfig();

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Microsoft Graph application credentials are not configured."
    );
  }

  const tokenUrl =
    `https://login.microsoftonline.com/${tenantId}` +
    "/oauth2/v2.0/token";

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await axios.post(tokenUrl, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: 20000,
  });

  return response.data.access_token;
}

function getPrimaryEmail(user) {
  return String(
    user.mail ||
    user.userPrincipalName ||
    ""
  )
    .trim()
    .toLowerCase();
}

function isCompanyUser(user, allowedDomain) {
  const email = getPrimaryEmail(user);

  if (!email) return false;

  return email.endsWith(
    `@${allowedDomain.toLowerCase()}`
  );
}

async function getUsers(options = {}) {
  const {
    includeGuests = false,
    includeDisabled = true,
  } = options;

  const token = await getAccessToken();
  const { allowedDomain } = getAzureConfig();

  const users = [];

  let nextUrl =
    "https://graph.microsoft.com/v1.0/users" +
    "?$top=999" +
    "&$select=" +
    [
      "id",
      "displayName",
      "givenName",
      "surname",
      "mail",
      "userPrincipalName",
      "jobTitle",
      "department",
      "officeLocation",
      "mobilePhone",
      "businessPhones",
      "accountEnabled",
      "userType",
      "createdDateTime",
    ].join(",");

  while (nextUrl) {
    const response = await axios.get(nextUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 30000,
    });

    const pageUsers = Array.isArray(response.data.value)
      ? response.data.value
      : [];

    users.push(...pageUsers);

    nextUrl = response.data["@odata.nextLink"] || null;
  }

  return users
    .filter((user) => {
      if (!includeGuests && user.userType === "Guest") {
        return false;
      }

      if (
        !includeDisabled &&
        user.accountEnabled === false
      ) {
        return false;
      }

      return isCompanyUser(user, allowedDomain);
    })
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
      businessPhone:
        Array.isArray(user.businessPhones)
          ? user.businessPhones[0] || ""
          : "",
      accountEnabled: user.accountEnabled !== false,
      userType: user.userType || "Member",
      microsoftCreatedAt: user.createdDateTime || null,
    }));
}

module.exports = {
  getAccessToken,
  getUsers,
};