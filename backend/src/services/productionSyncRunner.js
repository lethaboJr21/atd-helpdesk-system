const { syncBedlinerDailyProduction } = require("./syncBedlinerDailyProduction");

const RETRY_MAX = Number(process.env.PROD_SYNC_RETRY_MAX || 3);
const RETRY_BACKOFF_MS = Number(process.env.PROD_SYNC_RETRY_BACKOFF_MS || 2000);

let inFlight = false;

function isTransientError(err) {
  const name = String(err?.name || "");
  const message = String(err?.message || "");
  if (["ConnectionError", "ConnectionPoolError", "TimeoutError"].includes(name)) return true;
  if (["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ESOCKET"].some((code) => message.includes(code))) return true;
  return /request timed out|connection timed out|timeout expired/i.test(message);
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function logOutcome(record) { console.log(JSON.stringify({ ...record, timestamp: new Date().toISOString() })); }

async function runBedlinerSync({ trigger } = {}) {
  if (inFlight) {
    logOutcome({ outcome: "skipped", reason: "overlap", warningCode: "PROD_SYNC_SKIPPED_OVERLAP", trigger });
    return { outcome: "skipped", reason: "overlap", durationMs: 0, retriesConsumed: 0 };
  }
  inFlight = true;
  const startedAt = Date.now();
  let retriesConsumed = 0;
  try {
    while (true) {
      try {
        const result = await syncBedlinerDailyProduction();
        const durationMs = Date.now() - startedAt;
        logOutcome({ outcome: "succeeded", warningCode: "PROD_SYNC_SUCCEEDED", trigger, durationMs, synced: result?.synced });
        return { outcome: "succeeded", synced: result?.synced, durationMs, retriesConsumed };
      } catch (err) {
        if (!isTransientError(err) || retriesConsumed >= RETRY_MAX) {
          const durationMs = Date.now() - startedAt;
          const errorCode = err?.code || err?.name || "UNKNOWN";
          logOutcome({ outcome: "failed", warningCode: "PROD_SYNC_FAILED", trigger, durationMs, retriesConsumed, errorCode, message: err?.message });
          return { outcome: "failed", durationMs, retriesConsumed, errorCode };
        }
        retriesConsumed++;
        await sleep(RETRY_BACKOFF_MS * Math.pow(2, retriesConsumed - 1)); // 2s → 4s → 8s
      }
    }
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    logOutcome({ outcome: "failed", warningCode: "PROD_SYNC_FAILED", trigger, durationMs, retriesConsumed, errorCode: "UNEXPECTED", message: String(err?.message || err) });
    return { outcome: "failed", durationMs, retriesConsumed, errorCode: "UNEXPECTED" };
  } finally {
    inFlight = false; // lock released on every terminal path — a failed run never blocks the next tick
  }
}

module.exports = { runBedlinerSync };