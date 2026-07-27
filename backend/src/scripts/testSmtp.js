require("dotenv").config();

const net = require("net");
const tls = require("tls");

function readEmailConfiguration() {
  const host =
    process.env.SMTP_HOST ||
    process.env.EMAIL_HOST ||
    "";

  const port = Number(
    process.env.SMTP_PORT ||
      process.env.EMAIL_PORT ||
      0
  );

  const secureValue =
    process.env.SMTP_SECURE ||
    process.env.EMAIL_SECURE ||
    "false";

  const secure =
    String(secureValue).trim().toLowerCase() === "true";

  return {
    host,
    port,
    secure,
    userConfigured: Boolean(
      process.env.SMTP_USER ||
        process.env.EMAIL_USER
    ),
    passwordConfigured: Boolean(
      process.env.SMTP_PASSWORD ||
        process.env.EMAIL_PASS
    ),
    fromConfigured: Boolean(process.env.EMAIL_FROM),
  };
}

function validateConfiguration(configuration) {
  const errors = [];

  if (!configuration.host) {
    errors.push("SMTP host is not configured.");
  }

  if (!Number.isInteger(configuration.port) || configuration.port <= 0) {
    errors.push("SMTP port is not configured correctly.");
  }

  if (!configuration.userConfigured) {
    errors.push("SMTP username is not configured.");
  }

  if (!configuration.passwordConfigured) {
    errors.push("SMTP password is not configured.");
  }

  if (!configuration.fromConfigured) {
    errors.push("EMAIL_FROM is not configured.");
  }

  return errors;
}

function testTcpConnection(configuration) {
  return new Promise((resolve, reject) => {
    const timeoutMilliseconds = 10000;

    const connectionOptions = {
      host: configuration.host,
      port: configuration.port,
      servername: configuration.host,
    };

    const socket = configuration.secure
      ? tls.connect(connectionOptions)
      : net.connect(connectionOptions);

    socket.setTimeout(timeoutMilliseconds);

    socket.once("connect", () => {
      socket.end();
      resolve();
    });

    socket.once("secureConnect", () => {
      socket.end();
      resolve();
    });

    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("SMTP TCP connection timed out."));
    });

    socket.once("error", (error) => {
      reject(error);
    });
  });
}

async function run() {
  const configuration = readEmailConfiguration();
  const validationErrors = validateConfiguration(configuration);

  console.log("SMTP configuration check:");
  console.table({
    host: configuration.host || "NOT CONFIGURED",
    port: configuration.port || "NOT CONFIGURED",
    secure: configuration.secure,
    userConfigured: configuration.userConfigured,
    passwordConfigured: configuration.passwordConfigured,
    fromConfigured: configuration.fromConfigured,
  });

  if (validationErrors.length > 0) {
    console.error("SMTP configuration is incomplete:");

    for (const validationError of validationErrors) {
      console.error(`- ${validationError}`);
    }

    process.exitCode = 1;
    return;
  }

  try {
    await testTcpConnection(configuration);

    console.log(
      `SMTP TCP connection succeeded: ${configuration.host}:${configuration.port}`
    );
  } catch (error) {
    console.error("SMTP TCP connection failed:", {
      code: error.code || null,
      message: error.message,
      host: configuration.host,
      port: configuration.port,
      secure: configuration.secure,
    });

    process.exitCode = 1;
  }
}

run();
