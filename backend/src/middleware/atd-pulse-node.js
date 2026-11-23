/**
 * ATD Pulse - Node.js Express Error Snapshot & Telemetry Middleware
 * Usage in server.js:
 *   const pulse = require('./atd-pulse-node');
 *   app.use(pulse.requestTracker()); // Place at top of middleware stack
 *   app.use(pulse.errorHandler({ appId: 'atd-helpdesk' })); // Place at bottom of routes
 */

const os = require("os");

function sanitizePayload(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const sensitiveKeys = ["password", "token", "secret", "authorization", "apiKey", "access_token"];
  const clean = Array.isArray(obj) ? [] : {};
  for (const [key, val] of Object.entries(obj)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      clean[key] = "[REDACTED]";
    } else if (typeof val === "object" && val !== null) {
      clean[key] = sanitizePayload(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

function requestTracker() {
  return (req, res, next) => {
    req._pulseStartTime = Date.now();
    next();
  };
}

function errorHandler(options = {}) {
  const appId = options.appId || "node-app";
  const pulseHubUrl = options.pulseHubUrl || process.env.PULSE_HUB_URL || "http://127.0.0.1:3099/api/errors/ingest";

  // Capture unhandled rejections
  process.on("unhandledRejection", (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    dispatchSnapshot(pulseHubUrl, appId, err, null, "CRITICAL");
  });

  return (err, req, res, next) => {
    dispatchSnapshot(pulseHubUrl, appId, err, req, "ERROR");
    next(err);
  };
}

function dispatchSnapshot(hubUrl, appId, err, req, severity = "ERROR") {
  try {
    const errorPayload = {
      type: err.name || "Error",
      message: err.message || "Unknown error",
      stack: err.stack || "",
      code: err.code || err.status || 500
    };

    const requestPayload = req ? {
      method: req.method,
      url: req.originalUrl || req.url,
      headers: sanitizePayload(req.headers),
      query: sanitizePayload(req.query),
      body: sanitizePayload(req.body),
      ip: req.ip || req.connection?.remoteAddress
    } : null;

    const runtimePayload = {
      node_version: process.version,
      memory: process.memoryUsage(),
      uptime_seconds: process.uptime(),
      pid: process.pid,
      os_load: os.loadavg()
    };

    const snapshot = {
      app_id: appId,
      severity,
      error: errorPayload,
      request: requestPayload,
      runtime: runtimePayload,
      timestamp: new Date().toISOString()
    };

    if (process.env.PULSE_DUAL_WRITE !== "false") {
      try {
        const { captureError } = require("../services/errorLoggerService");
        captureError(
          {
            name: errorPayload.type,
            message: errorPayload.message,
            stack: errorPayload.stack,
            sourceFile: null,
            instrumentationMarker: appId,
          },
          {
            activeRoute: requestPayload?.url || null,
            environmentMetadata: { ...runtimePayload, appId, severity },
            isPartial: false,
          }
        ).catch(() => {});
      } catch (localWriteError) {
      }
    }

    fetch(hubUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
      signal: AbortSignal.timeout(3000)
    }).catch(() => {});
  } catch (e) {
  }
}

module.exports = {
  requestTracker,
  errorHandler,
  dispatchSnapshot
};
