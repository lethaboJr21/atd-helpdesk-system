require("dotenv").config();

const {
  isGraphEmailConfigured,
  getGraphAccessToken,
  sendGraphMail,
} = require("../services/graphEmail");

async function run() {
  const testRecipient =
    process.env.GRAPH_MAIL_TEST_RECIPIENT ||
    process.env.GRAPH_MAIL_SENDER;

  console.log("Microsoft Graph email configuration:");
  console.table({
    provider:
      process.env.EMAIL_PROVIDER ||
      "not configured",
    tenantConfigured: Boolean(
      process.env.GRAPH_MAIL_TENANT_ID
    ),
    clientConfigured: Boolean(
      process.env.GRAPH_MAIL_CLIENT_ID
    ),
    secretConfigured: Boolean(
      process.env.GRAPH_MAIL_CLIENT_SECRET
    ),
    sender:
      process.env.GRAPH_MAIL_SENDER ||
      "not configured",
    testRecipient:
      testRecipient || "not configured",
  });

  if (!isGraphEmailConfigured()) {
    throw new Error(
      "Microsoft Graph email configuration is incomplete."
    );
  }

  console.log(
    "Requesting Microsoft Graph access token..."
  );

  const accessToken =
    await getGraphAccessToken();

  console.log(
    "Access token acquired:",
    Boolean(accessToken)
  );

  console.log("Sending Graph test email...");

  const result = await sendGraphMail({
    to: testRecipient,
    subject: "ATD Helpdesk Graph Email Test",
    text:
      "ATD Helpdesk Microsoft Graph company email delivery is working.",
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;line-height:1.6;">
        <h2>ATD Helpdesk</h2>
        <p>Microsoft Graph company email delivery is working.</p>
        <p>${new Date().toISOString()}</p>
      </div>
    `,
  });

  console.log("Graph email result:", result);
}

run().catch((error) => {
  console.error(
    "Microsoft Graph email test failed:",
    {
      status:
        error.response?.status || null,
      code:
        error.response?.data?.error?.code ||
        error.code ||
        null,
      message:
        error.response?.data?.error?.message ||
        error.message,
      requestId:
        error.response?.headers?.["request-id"] ||
        null,
    }
  );

  process.exitCode = 1;
});
