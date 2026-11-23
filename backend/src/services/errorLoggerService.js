const pool = require("../db/pool");
const crypto = require("crypto");

const DEDUP_WINDOW_MS = parseInt(process.env.PULSE_DEDUP_WINDOW_MS || "300000", 10);
const RETENTION_DAYS = parseInt(process.env.PULSE_ERROR_RETENTION_DAYS || "90", 10);
const RATE_LIMIT_PER_MIN = parseInt(process.env.PULSE_RATE_LIMIT_PER_MIN || "60", 10);
const BUFFER_MAX = parseInt(process.env.PULSE_BUFFER_MAX || "100", 10);
const RESOLUTION_STATUSES = new Set(["open", "investigating", "fixed"]);

const SENSITIVE_KEYS = ["password", "token", "secret", "authorization", "apikey", "access_token", "refresh_token"];
const PII_KEYS = ["email", "phone", "employeeid", "employee_id", "userid", "user_id"];

let errorBuffer = [];
let rateLimitCount = 0;
let rateLimitWindowStart = Date.now();

function sanitizeValue(key, value) {
  const lowerKey = String(key).toLowerCase();
  if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) return "[REDACTED]";
  if (PII_KEYS.some((s) => lowerKey === s || lowerKey.includes(s))) {
    if (typeof value === "string") return `[HASH:${crypto.createHash("sha256").update(value).digest("hex").slice(0, 8)}]`;
  }
  return value;
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((x) => sanitizeObject(x));
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = typeof value === "object" ? sanitizeObject(value) : sanitizeValue(key, value);
  }
  return result;
}

function classifySeverity(error, context) {
  const errorType = String(error?.name || error?.errorType || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  if (errorType.includes("render") || context?.source === "error_boundary") return "Critical";
  if (errorType.includes("unhandledrejection") || errorType.includes("uncaughtexception")) return "High";
  if (context?.source === "axios_interceptor" && context?.status < 500) return "Medium";
  if (context?.source === "axios_interceptor") return "High";
  if (message.includes("warning") || context?.source === "warning") return "Low";
  return "Medium";
}

function computeDedupKey(errorType, sourceFile, errorMessage) {
  return crypto.createHash("sha256").update(`${errorType}|${sourceFile||""}|${errorMessage||""}`).digest("hex");
}

function inferRootCause(error, snapshot) {
  const stack = error?.stackTrace || error?.stack || "";
  const sourceFile = error?.sourceFile || "";
  const lines = stack.split("\n").filter(Boolean);
  const suspectedOrigin = sourceFile || (lines.find((l) => l.includes("at ")) || "").trim() || "unknown";
  const contributingFactors = [];
  if (snapshot?.isPartial) contributingFactors.push("Incomplete snapshot — some context fields were missing");
  if (snapshot?.activeRoute) contributingFactors.push(`Error occurred on route: ${snapshot.activeRoute}`);
  if (lines.length > 3) contributingFactors.push(`Stack trace depth: ${lines.length} frames`);
  const status = contributingFactors.length > 0 ? "inferred" : "unconfirmed";
  return { suspectedOrigin, contributingFactors, status, reasoningTrail: stack.slice(0, 2000) };
}

function checkRateLimit() {
  const now = Date.now();
  if (now - rateLimitWindowStart > 60000) {
    rateLimitCount = 0;
    rateLimitWindowStart = now;
  }
  rateLimitCount++;
  return rateLimitCount <= RATE_LIMIT_PER_MIN;
}

async function captureError(error, context = {}, options = {}) {
  if (!options.bypassRateLimit && !checkRateLimit()) return { rateLimited: true };
  const errorType = error?.name || error?.errorType || "Error";
  const errorMessage = error?.message || error?.errorMessage || String(error);
  const stackTrace = error?.stack || error?.stackTrace || null;
  const sourceFile = error?.sourceFile || context?.sourceFile || null;
  const buildVersion = error?.buildVersion || context?.buildVersion || process.env.BUILD_VERSION || null;
  const instrumentationMarker = error?.instrumentationMarker || context?.instrumentationMarker || null;
  const severity = classifySeverity(error, context);
  const dedupKey = computeDedupKey(errorType, sourceFile, errorMessage);
  const correlationId = options.correlationId || crypto.randomUUID();
  const snapshot = {
    activeRoute: context?.activeRoute || null,
    componentHierarchy: sanitizeObject(context?.componentHierarchy || null),
    userSessionContext: sanitizeObject(context?.userSessionContext || null),
    recentActionTrail: sanitizeObject(context?.recentActionTrail || null),
    environmentMetadata: sanitizeObject(context?.environmentMetadata || null),
    buildVersion,
    isPartial: Boolean(context?.isPartial),
    missingFields: context?.missingFields || [],
  };
  const rootCause = inferRootCause({ stackTrace, sourceFile, message: errorMessage }, snapshot);

  try {
    const existing = await pool.query(
      `SELECT "correlationId", "occurrenceCount" FROM error_log_entries
       WHERE "dedupKey"=$1 AND "lastOccurredAt" > NOW() - INTERVAL '1 millisecond' * $2 AND "archived_at" IS NULL
       ORDER BY "lastOccurredAt" DESC LIMIT 1`,
      [dedupKey, DEDUP_WINDOW_MS]
    );
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE error_log_entries
         SET "occurrenceCount"="occurrenceCount"+1,
             "lastOccurredAt"=NOW(),
             "resolutionStatus"=CASE WHEN "resolutionStatus"='fixed' THEN 'open' ELSE "resolutionStatus" END,
             "fixedAt"=CASE WHEN "resolutionStatus"='fixed' THEN NULL ELSE "fixedAt" END,
             "fixedBy"=CASE WHEN "resolutionStatus"='fixed' THEN NULL ELSE "fixedBy" END,
             "resolutionSolution"=CASE WHEN "resolutionStatus"='fixed' THEN NULL ELSE "resolutionSolution" END
         WHERE "correlationId"=$1`,
        [existing.rows[0].correlationId]
      );
      return { correlationId: existing.rows[0].correlationId, deduplicated: true, occurrenceCount: existing.rows[0].occurrenceCount + 1 };
    }
    await pool.query(
      `INSERT INTO error_log_entries ("correlationId","errorType","errorMessage","stackTrace","sourceFile","buildVersion","severity","dedupKey","instrumentationMarker","timestamp","lastOccurredAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())`,
      [correlationId, errorType, errorMessage, stackTrace, sourceFile, buildVersion, severity, dedupKey, instrumentationMarker]
    );
    await pool.query(
      `INSERT INTO error_snapshots ("correlationId","activeRoute","componentHierarchy","userSessionContext","recentActionTrail","environmentMetadata","buildVersion","isPartial","missingFields")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [correlationId, snapshot.activeRoute, JSON.stringify(snapshot.componentHierarchy), JSON.stringify(snapshot.userSessionContext), JSON.stringify(snapshot.recentActionTrail), JSON.stringify(snapshot.environmentMetadata), snapshot.buildVersion, snapshot.isPartial, snapshot.missingFields]
    );
    await pool.query(
      `INSERT INTO root_cause_records ("correlationId","suspectedOrigin","contributingFactors","status","reasoningTrail")
       VALUES ($1,$2,$3,$4,$5)`,
      [correlationId, rootCause.suspectedOrigin, rootCause.contributingFactors, rootCause.status, rootCause.reasoningTrail]
    );
    return { correlationId, deduplicated: false };
  } catch (dbError) {
    if (errorBuffer.length < BUFFER_MAX) {
      errorBuffer.push({ error, context, correlationId, bufferedAt: Date.now() });
    }
    return { correlationId, buffered: true };
  }
}

async function flushBuffer() {
  if (!errorBuffer.length) return;
  const items = errorBuffer.splice(0);
  for (const item of items) {
    await captureError(item.error, item.context, { bypassRateLimit: true, correlationId: item.correlationId });
  }
}

setInterval(() => { flushBuffer().catch(() => {}); }, 30000);

async function listEntries(filters = {}, pagination = {}) {
  const { severity, errorType, sourceFile, dateFrom, dateTo, resolutionStatus } = filters;
  const page = Math.max(1, pagination.page || 1);
  const limit = Math.min(50, pagination.limit || 50);
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  if (severity) { params.push(severity); conditions.push(`"severity"=$${params.length}`); }
  if (errorType) { params.push(`%${errorType}%`); conditions.push(`"errorType" ILIKE $${params.length}`); }
  if (sourceFile) { params.push(`%${sourceFile}%`); conditions.push(`"sourceFile" ILIKE $${params.length}`); }
  if (dateFrom) { params.push(dateFrom); conditions.push(`"timestamp">=$${params.length}`); }
  if (dateTo) { params.push(dateTo); conditions.push(`"timestamp"<=$${params.length}`); }
  if (resolutionStatus && resolutionStatus !== "all") {
    if (!RESOLUTION_STATUSES.has(resolutionStatus)) {
      throw Object.assign(new Error("Invalid error resolution status."), { status: 400 });
    }
    params.push(resolutionStatus);
    conditions.push(`"resolutionStatus"=$${params.length}`);
  }
  conditions.push(`"archived_at" IS NULL`);
  const where = `WHERE ${conditions.join(" AND ")}`;
  const r = await pool.query(
    `SELECT "correlationId","errorType","errorMessage","severity","sourceFile","timestamp","occurrenceCount","lastOccurredAt","buildVersion","instrumentationMarker","resolutionStatus","resolutionSolution","fixedAt","fixedBy"
     FROM error_log_entries ${where}
     ORDER BY "timestamp" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const count = await pool.query(`SELECT COUNT(*)::int total FROM error_log_entries ${where}`, params);
  return { entries: r.rows, total: count.rows[0].total, page, limit };
}

async function getEntryDetail(correlationId, isDeveloper = true) {
  const entry = await pool.query(
    `SELECT * FROM error_log_entries WHERE "correlationId"=$1`,
    [correlationId]
  );
  if (!entry.rows.length) return null;
  const snapshot = await pool.query(`SELECT * FROM error_snapshots WHERE "correlationId"=$1`, [correlationId]);
  const rootCause = await pool.query(`SELECT * FROM root_cause_records WHERE "correlationId"=$1`, [correlationId]);
  const result = {
    entry: { ...entry.rows[0] },
    snapshot: snapshot.rows[0] || null,
    rootCause: rootCause.rows[0] || null,
  };
  if (!isDeveloper) {
    result.entry.stackTrace = "[Stack traces are visible to developers only]";
    if (result.entry.sourceFile) result.entry.sourceFile = "[Path redacted]";
  }
  return result;
}

async function confirmRootCause(correlationId, developerId, refinement) {
  const r = await pool.query(
    `UPDATE root_cause_records SET "status"='confirmed', "confirmedBy"=$2, "confirmedAt"=NOW(),
     "suspectedOrigin"=COALESCE($3, "suspectedOrigin")
     WHERE "correlationId"=$1 RETURNING *`,
    [correlationId, developerId, refinement?.suspectedOrigin || null]
  );
  return r.rows[0] || null;
}

async function updateResolution(correlationId, input = {}, userId) {
  const status = String(input.status || "").trim().toLowerCase();
  if (!RESOLUTION_STATUSES.has(status)) {
    throw Object.assign(new Error("Choose Open, Investigating or Fixed."), { status: 400 });
  }

  const solution = String(input.solution || "").trim();
  if (status === "fixed" && !solution) {
    throw Object.assign(new Error("Record the solution introduced before marking this error fixed."), { status: 400 });
  }

  const result = await pool.query(
    `UPDATE error_log_entries
     SET "resolutionStatus"=$2,
         "resolutionSolution"=CASE WHEN $2='fixed' THEN $3 ELSE "resolutionSolution" END,
         "fixedAt"=CASE WHEN $2='fixed' THEN NOW() ELSE NULL END,
         "fixedBy"=CASE WHEN $2='fixed' THEN $4 ELSE NULL END
     WHERE "correlationId"=$1 AND "archived_at" IS NULL
     RETURNING "correlationId","resolutionStatus","resolutionSolution","fixedAt","fixedBy"`,
    [correlationId, status, solution || null, userId]
  );
  return result.rows[0] || null;
}

module.exports = {
  captureError,
  listEntries,
  getEntryDetail,
  confirmRootCause,
  updateResolution,
  flushBuffer,
  classifySeverity,
  sanitizeObject,
};