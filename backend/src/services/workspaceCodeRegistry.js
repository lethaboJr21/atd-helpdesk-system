const pool = require("../db/pool");

const LEGACY_TO_CANONICAL = {
  fin: [
    "finance",
    "finance department",
  ],
  it: [
    "it",
    "information technology",
    "it service request",
    "erp / syspro",
    "change management",
    "project management",
  ],
  hr: [
    "hr",
    "human resources",
  ],
  fac: [
    "fac",
    "facilities",
  ],
  pdm: [
    "process engineering (pdm)",
    "pdm",
    "process engineering",
  ],
};

const CANONICAL_CODES = ["IT", "HR", "FIN", "FAC", "PDM"];

const LOOKUP = {};
for (const [canonical, legacyValues] of Object.entries(LEGACY_TO_CANONICAL)) {
  for (const legacy of legacyValues) {
    LOOKUP[legacy.toLowerCase()] = canonical.toUpperCase();
  }
  LOOKUP[canonical.toLowerCase()] = canonical.toUpperCase();
}

function normaliseWorkspaceCode(value) {
  if (value === null || value === undefined) return null;
  const lower = String(value).trim().toLowerCase();
  if (lower === "") return null;
  return LOOKUP[lower] || null;
}

function getCanonicalCodes() {
  return [...CANONICAL_CODES];
}

function getLegacyMapping() {
  const mapping = {};
  for (const [canonical, legacyValues] of Object.entries(LEGACY_TO_CANONICAL)) {
    for (const legacy of legacyValues) {
      mapping[legacy.toLowerCase()] = canonical.toUpperCase();
    }
  }
  return mapping;
}

async function loadActiveCodes() {
  const res = await pool.query(
    "SELECT code FROM service_workspaces WHERE status = 'active' ORDER BY code"
  );
  return res.rows.map((r) => r.code);
}

async function isValidCode(code) {
  const activeCodes = await loadActiveCodes();
  return activeCodes.includes(code);
}

module.exports = {
  LEGACY_TO_CANONICAL,
  CANONICAL_CODES,
  normaliseWorkspaceCode,
  getCanonicalCodes,
  getLegacyMapping,
  loadActiveCodes,
  isValidCode,
};