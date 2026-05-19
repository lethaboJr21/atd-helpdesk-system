require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");
const statsRoutes = require("./routes/stats");
const productionRoutes = require("./routes/production");
const logRoutes = require("./routes/logs");
const notificationRoutes = require("./routes/notifications");

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: "1mb" }));

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many login attempts" },
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
});

app.use("/api/auth/login", loginLimiter);
app.use("/api", apiLimiter);

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/notifications", notificationRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    ts: new Date().toISOString(),
  });
});

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "../../frontend/dist");
  app.use(express.static(distPath));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Start
server.listen(PORT, "127.0.0.1", () => {
  console.log(`✅  ATD Helpdesk API running on port ${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;