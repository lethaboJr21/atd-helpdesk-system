const axios = require("axios");

const TENANT_ID = process.env.GRAPH_MAIL_TENANT_ID;
const CLIENT_ID = process.env.GRAPH_MAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GRAPH_MAIL_CLIENT_SECRET;
const SENDER = process.env.GRAPH_MAIL_SENDER;
const DEFAULT_REPLY_TO = process.env.EMAIL_REPLY_TO || SENDER;
const TOKEN_EARLY_EXPIRY_MS = 5 * 60 * 1000;

let tokenCache = { accessToken: null, expiresAt: 0 };

function isGraphEmailConfigured() {
  return Boolean(TENANT_ID && CLIENT_ID && CLIENT_SECRET && SENDER);
}

function normalizeRecipients(recipients) {
  if (!recipients) return [];
  const values = Array.isArray(recipients) ? recipients : String(recipients).split(/[;,]/);
  return Array.from(new Set(values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)));
}

function toGraphRecipients(recipients) {
  return normalizeRecipients(recipients).map((address) => ({ emailAddress: { address } }));
}

async function getGraphAccessToken() {
  if (!isGraphEmailConfigured()) throw new Error("Microsoft Graph email configuration is incomplete.");
  if (tokenCache.accessToken && tokenCache.expiresAt > Date.now() + TOKEN_EARLY_EXPIRY_MS) return tokenCache.accessToken;

  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const requestBody = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await axios.post(tokenUrl, requestBody.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: Number(process.env.GRAPH_TOKEN_TIMEOUT || 20000),
  });

  const expiresInSeconds = Number(response.data.expires_in) || 3600;
  tokenCache = {
    accessToken: response.data.access_token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
  return tokenCache.accessToken;
}

async function verifyGraphEmailConfiguration() {
  const accessToken = await getGraphAccessToken();
  return { provider: "microsoft-graph", tokenAcquired: Boolean(accessToken), sender: SENDER };
}

async function sendGraphMail({ to, cc, bcc, subject, html, text, replyTo }) {
  const toRecipients = toGraphRecipients(to);
  if (!toRecipients.length) return { sent: false, skipped: true, provider: "microsoft-graph", reason: "No valid recipients were provided." };
  if (!String(subject || "").trim()) throw new Error("Email subject is required.");

  const accessToken = await getGraphAccessToken();
  const endpoint = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER)}/sendMail`;
  const ccRecipients = toGraphRecipients(cc);
  const bccRecipients = toGraphRecipients(bcc);
  const replyToRecipients = toGraphRecipients(replyTo || DEFAULT_REPLY_TO);
  const message = {
    subject: String(subject).trim(),
    body: { contentType: html ? "HTML" : "Text", content: html || text || "" },
    toRecipients,
  };
  if (ccRecipients.length) message.ccRecipients = ccRecipients;
  if (bccRecipients.length) message.bccRecipients = bccRecipients;
  if (replyToRecipients.length) message.replyTo = replyToRecipients;

  const response = await axios.post(
    endpoint,
    { message, saveToSentItems: true },
    {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      timeout: Number(process.env.GRAPH_SEND_TIMEOUT || 30000),
    }
  );

  return {
    sent: response.status === 202,
    skipped: false,
    provider: "microsoft-graph",
    status: response.status,
    sender: SENDER,
    recipientCount: toRecipients.length + ccRecipients.length + bccRecipients.length,
    requestId: response.headers?.["request-id"] || null,
  };
}

function clearGraphTokenCache() {
  tokenCache = { accessToken: null, expiresAt: 0 };
}

module.exports = {
  isGraphEmailConfigured,
  getGraphAccessToken,
  verifyGraphEmailConfiguration,
  sendGraphMail,
  clearGraphTokenCache,
};
