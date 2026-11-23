const { captureError } = require("../services/errorLoggerService");

function warnSchemaDrift({ route, table, error, context } = {}) {
  try {
    const pgCode = error?.code || "UNKNOWN";
    const message = String(error?.message || "");
    const missingObject = (message.match(/(?:column|relation) (.+?) does not exist/) || [null, null])[1] || message;
    const record = { warningCode: "SCHEMA_DRIFT_TOLERATED", route, table, pgCode, missingObject, timestamp: new Date().toISOString() };
    console.warn(JSON.stringify(record));
    captureError(
      { name: "SchemaDriftWarning", message: `SCHEMA_DRIFT_TOLERATED: ${pgCode} ${message}` },
      { source: "warning", activeRoute: route, sourceFile: "utils/schemaDriftWarning.js", ...(context || {}) }
    ).catch(() => {});
  } catch { /* never throw — the tolerated query must still return its degraded result */ }
}

module.exports = { warnSchemaDrift };