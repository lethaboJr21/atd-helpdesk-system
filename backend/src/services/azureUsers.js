const axios = require("axios");

async function getAccessToken() {
  const res = await axios.post(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID,
      client_secret: process.env.AZURE_CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    })
  );

  return res.data.access_token;
}

async function getUsers() {
  const token = await getAccessToken();

  const res = await axios.get("https://graph.microsoft.com/v1.0/users", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data.value;
}

module.exports = { getUsers };
