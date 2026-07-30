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
const jsonErrorHandler = require(
  "./middleware/jsonErrorHandler"
);

const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");
const statsRoutes = require("./routes/stats");
const productionRoutes = require("./routes/production");
const logRoutes = require("./routes/logs");
const notificationRoutes = require("./routes/notifications");
const groupRoutes = require("./routes/groups");
const azureRoutes = require("./routes/azure");
const userRoutes = require("./routes/users");
const assetRoutes = require("./routes/assets");
const productionSyncRoutes = require(
  "./routes/productionSync"
);
const productionEventRoutes = require(
  "./routes/productionEvents"
);

const {
  startTicketReminderJob,
} = require("./services/ticketReminders");

const {
  startProductionSyncScheduler,
} = require("./services/productionSyncScheduler");

const {
  EMAIL_PROVIDER,
  verifyEmailProvider,
} = require("./services/email");

const app = express();
const server = http.createServer(app);

const PORT =
  Number.parseInt(process.env.PORT, 10) ||
  3001;

const CORS_ORIGINS = String(
  process.env.CORS_ORIGIN ||
    "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  return CORS_ORIGINS.includes(origin);
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error(
        "The request origin is not allowed by CORS."
      )
    );
  },
  credentials: true,
  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],
};

app.set("trust proxy", 1);

const io = new Server(server, {
  cors: corsOptions,
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(cors(corsOptions));

app.use(
  express.json({
    limit: "1mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error:
      "Too many login attempts. Please try again later.",
  },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error:
      "Too many requests. Please try again shortly.",
  },
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
app.use("/api/assets", assetRoutes);
app.use("/api/production", productionRoutes);
app.use(
  "/api/production/sync",
  productionSyncRoutes
);
app.use(
  "/api/production/events",
  productionEventRoutes
);

app.get(
  "/api/knowledge",
  auth,
  async (_request, response) => {
    try {
      const result = await pool.query(
        `
        SELECT *
        FROM knowledge_base
        ORDER BY title
        `
      );

      return response.json(result.rows);
    } catch (error) {
      console.error(
        "Knowledge fetch failed:",
        error.message
      );

      return response.status(500).json({
        error: "Failed to fetch knowledge",
      });
    }
  }
);

app.get("/api", (_request, response) => {
  return response.json({
    ok: true,
    message: "ATD Helpdesk API is running",
    environment:
      process.env.NODE_ENV ||
      "development",
    emailProvider: EMAIL_PROVIDER,
    timestamp: new Date().toISOString(),
  });
});

app.get(
  "/api/health",
  async (_request, response) => {
    let databaseStatus = "unknown";

    try {
      await pool.query("SELECT 1");
      databaseStatus = "healthy";
    } catch (_error) {
      databaseStatus = "unhealthy";
    }

    const healthy =
      databaseStatus === "healthy";

    return response
      .status(healthy ? 200 : 503)
      .json({
        ok: healthy,
        service: "ATD Helpdesk API",
        status: healthy
          ? "healthy"
          : "degraded",
        database: databaseStatus,
        emailProvider: EMAIL_PROVIDER,
        timestamp: new Date().toISOString(),
      });
  }
);

app.use(jsonErrorHandler);

app.use(
  (error, request, response, next) => {
    if (response.headersSent) {
      return next(error);
    }

    console.error("Unhandled API error:", {
      method: request.method,
      path: request.originalUrl,
      userId: request.user?.id || null,
      message: error.message,
      code: error.code || null,
    });

    return response.status(
      error.status || 500
    ).json({
      error:
        process.env.NODE_ENV === "production"
          ? "An unexpected server error occurred."
          : error.message,
    });
  }
);

if (process.env.NODE_ENV === "production") {
  const distPath = path.join(
    __dirname,
    "../../frontend/dist"
  );

  app.use(express.static(distPath));

  app.get("*", (_request, response) => {
    return response.sendFile(
      path.join(distPath, "index.html")
    );
  });
}

function startBackgroundJobs() {
  startTicketReminderJob();
  startProductionSyncScheduler();
}

server.listen(
  PORT,
  "127.0.0.1",
  async () => {
    console.log(
      `ATD Helpdesk API running on port ${PORT}`
    );

    console.log(
      `ENV: ${
        process.env.NODE_ENV ||
        "development"
      }`
    );

    console.log(
      `Email provider: ${EMAIL_PROVIDER}`
    );

    startBackgroundJobs();

    try {
      await verifyEmailProvider();
    } catch (error) {
      console.error(
        "Email verification startup failure:",
        error.message
      );
    }
  }
);

module.exports = app;
