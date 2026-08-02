require("dotenv").config();

const path = require("path");
const http = require("http");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");

const pool = require("./db/pool");
const auth = require("./middleware/auth");
const jsonErrorHandler = require("./middleware/jsonErrorHandler");

const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");
const statsRoutes = require("./routes/stats");
const productionRoutes = require("./routes/production");
const logRoutes = require("./routes/logs");
const notificationRoutes = require("./routes/notifications");
const groupRoutes = require("./routes/groups");
const azureRoutes = require("./routes/azure");
const userRoutes = require("./routes/users");
const settingsRoutes = require("./routes/settings");
const adminControlsRoutes = require("./routes/adminControls");
const assetRoutes = require("./routes/assets");
const productionSyncRoutes = require("./routes/productionSync");
const productionEventRoutes = require("./routes/productionEvents");

const { startTicketReminderJob } = require("./services/ticketReminders");
const { startProductionSyncScheduler } = require("./services/productionSyncScheduler");
const { EMAIL_PROVIDER, verifyEmailProvider } = require("./services/email");

const app = express();
const server = http.createServer(app);
const PORT = Number.parseInt(process.env.PORT || "3001", 10);

function normalizeOrigin(value) {
  const origin = String(value || "").trim().replace(/\/$/, "");
  return origin || null;
}

const configuredOrigins = String(
  process.env.CORS_ORIGIN || "https://portal.atdalliance.co.za,http://localhost:5173"
).split(",").map(normalizeOrigin).filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  return allowedOrigins.has(normalizeOrigin(origin));
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    const error = new Error("The request origin is not allowed by CORS.");
    error.status = 403;
    error.code = "CORS_ORIGIN_DENIED";
    return callback(error);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["X-Request-Id"],
  maxAge: 86400,
};

app.set("trust proxy", 1);
app.disable("x-powered-by");

const io = new Server(server, { cors: corsOptions, transports: ["websocket", "polling"] });
app.set("io", io);
io.on("connection", (socket) => socket.on("disconnect", () => {}));

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "2mb" }));
app.use(express.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || "2mb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT || 20),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later.", code: "LOGIN_RATE_LIMITED" },
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT || 300),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again shortly.", code: "API_RATE_LIMITED" },
});

app.use("/api/auth/login", loginLimiter);
app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/azure", azureRoutes);
app.use("/api/users", userRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/admin-controls", adminControlsRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/production/sync", productionSyncRoutes);
app.use("/api/production/events", productionEventRoutes);

app.get("/api/knowledge", auth, async (_request, response) => {
  try {
    const result = await pool.query("SELECT * FROM knowledge_base ORDER BY title");
    return response.json(result.rows);
  } catch (error) {
    return response.status(500).json({ error: "Failed to fetch knowledge articles." });
  }
});

app.get("/api", (_request, response) => response.json({
  ok: true,
  message: "ATD Helpdesk API is running",
  environment: process.env.NODE_ENV || "development",
  emailProvider: EMAIL_PROVIDER,
  timestamp: new Date().toISOString(),
}));

app.get("/api/health", async (_request, response) => {
  let database = "unknown";
  try { await pool.query("SELECT 1"); database = "healthy"; }
  catch (_error) { database = "unhealthy"; }
  const healthy = database === "healthy";
  return response.status(healthy ? 200 : 503).json({
    ok: healthy,
    service: "ATD Helpdesk API",
    status: healthy ? "healthy" : "degraded",
    database,
    emailProvider: EMAIL_PROVIDER,
    timestamp: new Date().toISOString(),
  });
});

app.use(jsonErrorHandler);
app.use((error, request, response, next) => {
  if (response.headersSent) return next(error);
  console.error("Unhandled API error:", {
    method: request.method,
    path: request.originalUrl,
    userId: request.user?.id || null,
    message: error.message,
    code: error.code || null,
  });
  return response.status(error.status || 500).json({
    error: process.env.NODE_ENV === "production" && !error.status
      ? "An unexpected server error occurred."
      : error.message,
    code: error.code || "UNEXPECTED_API_ERROR",
  });
});

if (process.env.NODE_ENV === "production" && process.env.SERVE_FRONTEND_FROM_NODE === "true") {
  const distPath = path.join(__dirname, "../../frontend/dist");
  app.use(express.static(distPath));
  app.get("*", (_request, response) => response.sendFile(path.join(distPath, "index.html")));
}

function startBackgroundJobs() {
  try { startTicketReminderJob(); }
  catch (error) { console.error("Ticket reminder scheduler startup failed:", error.message); }
  try { startProductionSyncScheduler(); }
  catch (error) { console.error("Production sync scheduler startup failed:", error.message); }
}

server.listen(PORT, "127.0.0.1", async () => {
  console.log(`ATD Helpdesk API running on port ${PORT}`);
  console.log(`ENV: ${process.env.NODE_ENV || "development"}`);
  console.log(`Email provider: ${EMAIL_PROVIDER}`);
  console.log("CORS origins:", configuredOrigins);
  startBackgroundJobs();
  try { await verifyEmailProvider(); }
  catch (error) { console.error("Email verification startup failure:", error.message); }
});

function shutdown(signal) {
  console.log(`${signal} received. Closing ATD Helpdesk API.`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = app;
