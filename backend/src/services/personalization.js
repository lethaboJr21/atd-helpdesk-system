/**
 * Personalized "most used" modules / shortcuts for employee home.
 *
 * - Enough personal tickets → rank from the requester's own history
 * - Otherwise → rank from peers in the same department
 * - No department / thin peer data → sensible org defaults
 */

const pool = require("../db/pool");

const PERSONAL_THRESHOLD = Math.max(
  3,
  Number.parseInt(process.env.PERSONAL_MODULE_THRESHOLD || "5", 10) || 5
);

const MODULE_ORDER = ["incident", "service", "asset", "change"];

const MODULE_META = {
  incident: { label: "Report an Incident" },
  service: { label: "Request a Service" },
  asset: { label: "Request an Asset" },
  change: { label: "Request a Change" },
};

const SHORTCUT_META = {
  syspro_issue: {
    label: "Syspro issue",
    kind: "guided",
    guideKey: "syspro_issue",
  },
  qmuzik_issue: {
    label: "QMuzik issue",
    kind: "guided",
    guideKey: "qmuzik_issue",
  },
  printer_issue: {
    label: "Printer or scanner issue",
    kind: "guided",
    guideKey: "printer_issue",
  },
  laptop_issue: {
    label: "Laptop or PC issue",
    kind: "guided",
    guideKey: "laptop_issue",
  },
  syspro_catalog: {
    label: "Syspro",
    kind: "catalog",
    path: "/services?category=atd-syspro",
    hint: "Catalog",
  },
  qmuzik_catalog: {
    label: "QMuzik",
    kind: "catalog",
    path: "/services?category=atd-qmuzik",
    hint: "Catalog",
  },
};

const DEFAULT_MODULES = [
  { key: "incident", score: 4 },
  { key: "service", score: 3 },
  { key: "asset", score: 2 },
  { key: "change", score: 1 },
];

const DEFAULT_SHORTCUTS = [
  { key: "syspro_issue", score: 4 },
  { key: "printer_issue", score: 3 },
  { key: "laptop_issue", score: 2 },
  { key: "qmuzik_issue", score: 1 },
  { key: "syspro_catalog", score: 2 },
  { key: "qmuzik_catalog", score: 1 },
];

/** Soft priors when a department has little peer history. */
const DEPARTMENT_PRIORS = {
  finance: {
    modules: { incident: 5, service: 3, asset: 1, change: 1 },
    shortcuts: {
      syspro_issue: 6,
      syspro_catalog: 4,
      printer_issue: 2,
      laptop_issue: 2,
      qmuzik_issue: 1,
      qmuzik_catalog: 1,
    },
  },
  commercial: {
    modules: { incident: 5, service: 2, asset: 1, change: 1 },
    shortcuts: {
      syspro_issue: 5,
      syspro_catalog: 3,
      printer_issue: 2,
      laptop_issue: 2,
      qmuzik_issue: 1,
    },
  },
  procurement: {
    modules: { incident: 5, service: 2, asset: 1, change: 1 },
    shortcuts: {
      syspro_issue: 6,
      printer_issue: 2,
      laptop_issue: 1,
      syspro_catalog: 2,
    },
  },
  logistics: {
    modules: { incident: 5, service: 2, asset: 1, change: 1 },
    shortcuts: {
      syspro_issue: 4,
      printer_issue: 5,
      laptop_issue: 2,
      syspro_catalog: 1,
    },
  },
  "human resources": {
    modules: { incident: 3, service: 3, asset: 2, change: 1 },
    shortcuts: {
      printer_issue: 4,
      laptop_issue: 4,
      syspro_issue: 1,
    },
  },
  hr: {
    modules: { incident: 3, service: 3, asset: 2, change: 1 },
    shortcuts: {
      printer_issue: 4,
      laptop_issue: 4,
      syspro_issue: 1,
    },
  },
  "information technology": {
    modules: { incident: 4, service: 3, asset: 2, change: 2 },
    shortcuts: {
      syspro_issue: 3,
      laptop_issue: 3,
      printer_issue: 2,
      qmuzik_issue: 1,
      syspro_catalog: 1,
    },
  },
  it: {
    modules: { incident: 4, service: 3, asset: 2, change: 2 },
    shortcuts: {
      syspro_issue: 3,
      laptop_issue: 3,
      printer_issue: 2,
    },
  },
  production: {
    modules: { incident: 5, service: 2, asset: 1, change: 1 },
    shortcuts: {
      printer_issue: 3,
      syspro_issue: 3,
      laptop_issue: 2,
      qmuzik_issue: 2,
    },
  },
  maintenance: {
    modules: { incident: 5, service: 2, asset: 1, change: 1 },
    shortcuts: {
      syspro_issue: 4,
      printer_issue: 3,
      laptop_issue: 2,
      syspro_catalog: 2,
    },
  },
  quality: {
    modules: { incident: 5, service: 2, asset: 1, change: 1 },
    shortcuts: {
      syspro_issue: 3,
      printer_issue: 2,
      laptop_issue: 2,
      qmuzik_issue: 2,
    },
  },
  scm: {
    modules: { incident: 5, service: 2, asset: 1, change: 1 },
    shortcuts: {
      syspro_issue: 5,
      printer_issue: 2,
      syspro_catalog: 2,
      laptop_issue: 1,
    },
  },
  pdm: {
    modules: { incident: 5, service: 2, asset: 2, change: 1 },
    shortcuts: {
      syspro_issue: 4,
      laptop_issue: 2,
      printer_issue: 2,
    },
  },
};

const MODULE_SQL = `
CASE
  WHEN LOWER(COALESCE(t.ticket_type, '')) IN ('asset_request') THEN 'asset'
  WHEN LOWER(COALESCE(t.ticket_type, '')) IN ('change')
    OR t.workspace = 'Change Management' THEN 'change'
  WHEN LOWER(COALESCE(t.ticket_type, '')) IN ('service_request', 'request')
    OR t.ticket_type = 'Service Request'
    OR t.workspace = 'IT Service Request' THEN
      CASE
        WHEN t.category ILIKE '%Hardware Provisioning%'
          OR t.category ILIKE 'Hardware /Equipment'
          OR COALESCE(t.request_details->>'catalogCategory', '') ILIKE '%Hardware%'
          THEN 'asset'
        ELSE 'service'
      END
  WHEN LOWER(COALESCE(t.ticket_type, '')) IN ('incident')
    OR t.ticket_type = 'Incident' THEN 'incident'
  ELSE 'incident'
END
`;

const SHORTCUT_SQL = `
CASE
  WHEN t.category ILIKE '%Master Data%'
    OR t.sub_category ILIKE '%BOM%'
    OR t.sub_category ILIKE '%Purchase Price%'
    OR t.sub_category ILIKE '%Sales Price%'
    OR t.sub_category ILIKE '%Stock Code%'
    OR COALESCE(t.request_details->>'catalogCategory', '') ILIKE 'Syspro'
    OR (
      LOWER(COALESCE(t.ticket_type, '')) IN ('service_request', 'request', 'asset_request')
      AND (t.sub_category ILIKE '%Syspro%' OR t.title ILIKE '%syspro%')
    )
    THEN 'syspro_catalog'
  WHEN COALESCE(t.request_details->>'catalogCategory', '') ILIKE 'QMuzik'
    OR (
      LOWER(COALESCE(t.ticket_type, '')) IN ('service_request', 'request')
      AND (t.sub_category ILIKE '%QMuzik%' OR t.sub_category ILIKE '%Qmuz%' OR t.title ILIKE '%qmuz%')
    )
    THEN 'qmuzik_catalog'
  WHEN t.sub_category ILIKE '%Syspro%'
    OR t.category ILIKE '%Syspro%'
    OR t.title ILIKE '%syspro%'
    THEN 'syspro_issue'
  WHEN t.sub_category ILIKE '%QMuzik%'
    OR t.sub_category ILIKE '%Qmuz%'
    OR t.title ILIKE '%qmuz%'
    THEN 'qmuzik_issue'
  WHEN t.sub_category ILIKE '%Printer%'
    OR t.sub_category ILIKE '%scanner%'
    OR t.title ILIKE '%print%'
    THEN 'printer_issue'
  WHEN t.sub_category ILIKE '%Laptop%'
    OR t.sub_category ILIKE '%Computer%'
    OR t.title ILIKE '%laptop%'
    THEN 'laptop_issue'
  ELSE NULL
END
`;

function normalizeDepartment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function priorForDepartment(department) {
  const key = normalizeDepartment(department);
  if (!key) return null;
  if (DEPARTMENT_PRIORS[key]) return DEPARTMENT_PRIORS[key];
  // Fuzzy contains match for values like "Finance Department"
  const hit = Object.keys(DEPARTMENT_PRIORS).find(
    (name) => key.includes(name) || name.includes(key)
  );
  return hit ? DEPARTMENT_PRIORS[hit] : null;
}

function scoreMapFromRows(rows, keyField = "key") {
  const scores = {};
  for (const row of rows) {
    const key = row[keyField];
    if (!key) continue;
    scores[key] = (scores[key] || 0) + Number(row.score || row.n || 0);
  }
  return scores;
}

function mergeScores(...maps) {
  const out = {};
  for (const map of maps) {
    if (!map) continue;
    for (const [key, value] of Object.entries(map)) {
      out[key] = (out[key] || 0) + Number(value || 0);
    }
  }
  return out;
}

function rankedList(scores, orderedKeys, meta, limit = orderedKeys.length) {
  return orderedKeys
    .map((key) => ({
      key,
      score: Number(scores[key] || 0),
      ...(meta[key] || {}),
    }))
    .sort((a, b) => b.score - a.score || orderedKeys.indexOf(a.key) - orderedKeys.indexOf(b.key))
    .slice(0, limit);
}

async function countModules({ userId = null, department = null, excludeUserId = null }) {
  const conditions = ["t.requester_id IS NOT NULL"];
  const values = [];

  if (userId) {
    values.push(userId);
    conditions.push(`t.requester_id = $${values.length}`);
  }

  if (department) {
    values.push(department);
    conditions.push(
      `EXISTS (
         SELECT 1 FROM users u
         WHERE u.id = t.requester_id
           AND LOWER(TRIM(COALESCE(u.department, ''))) = LOWER(TRIM($${values.length}))
       )`
    );
  }

  if (excludeUserId) {
    values.push(excludeUserId);
    conditions.push(`t.requester_id <> $${values.length}`);
  }

  const where = conditions.join(" AND ");

  const [modules, shortcuts, sample] = await Promise.all([
    pool.query(
      `
      SELECT ${MODULE_SQL} AS key,
             COUNT(*)::int AS score
        FROM tickets t
       WHERE ${where}
       GROUP BY 1
      `,
      values
    ),
    pool.query(
      `
      SELECT ${SHORTCUT_SQL} AS key,
             COUNT(*)::int AS score
        FROM tickets t
       WHERE ${where}
         AND (${SHORTCUT_SQL}) IS NOT NULL
       GROUP BY 1
      `,
      values
    ),
    pool.query(
      `SELECT COUNT(*)::int AS n FROM tickets t WHERE ${where}`,
      values
    ),
  ]);

  return {
    sampleSize: sample.rows[0]?.n || 0,
    modules: scoreMapFromRows(modules.rows),
    shortcuts: scoreMapFromRows(shortcuts.rows),
  };
}

function decorateSource(source, department, sampleSize) {
  if (source === "personal") {
    return {
      source,
      label: "Based on your requests",
      description: `Ranked from ${sampleSize} ticket${sampleSize === 1 ? "" : "s"} you have raised.`,
    };
  }
  if (source === "department") {
    return {
      source,
      label: department
        ? `Popular in ${department}`
        : "Popular in your department",
      description: department
        ? `Suggested from what ${department} usually requests.`
        : "Suggested from department request patterns.",
    };
  }
  return {
    source: "default",
    label: "Suggested for you",
    description: "Starting recommendations until we learn your request patterns.",
  };
}

async function getPersonalizedModules(userId) {
  const userResult = await pool.query(
    `SELECT id, department
       FROM users
      WHERE id = $1
      LIMIT 1`,
    [userId]
  );
  const user = userResult.rows[0];
  if (!user) {
    return {
      ...decorateSource("default", null, 0),
      threshold: PERSONAL_THRESHOLD,
      sampleSize: 0,
      department: null,
      modules: rankedList(
        scoreMapFromRows(DEFAULT_MODULES),
        MODULE_ORDER,
        MODULE_META
      ),
      shortcuts: rankedList(
        scoreMapFromRows(DEFAULT_SHORTCUTS),
        Object.keys(SHORTCUT_META),
        SHORTCUT_META
      ),
    };
  }

  const personal = await countModules({ userId: user.id });
  let source = "personal";
  let modulesScores = personal.modules;
  let shortcutScores = personal.shortcuts;
  let sampleSize = personal.sampleSize;
  const department = user.department || null;
  const prior = priorForDepartment(department);

  if (personal.sampleSize < PERSONAL_THRESHOLD) {
    if (department) {
      const peers = await countModules({
        department,
        excludeUserId: user.id,
      });
      if (peers.sampleSize > 0) {
        source = "department";
        sampleSize = peers.sampleSize;
        modulesScores = mergeScores(peers.modules, prior?.modules);
        shortcutScores = mergeScores(peers.shortcuts, prior?.shortcuts);
      } else if (prior) {
        source = "department";
        sampleSize = 0;
        modulesScores = { ...prior.modules };
        shortcutScores = { ...prior.shortcuts };
      } else {
        source = "default";
        modulesScores = scoreMapFromRows(DEFAULT_MODULES);
        shortcutScores = scoreMapFromRows(DEFAULT_SHORTCUTS);
      }
    } else {
      source = "default";
      modulesScores = scoreMapFromRows(DEFAULT_MODULES);
      shortcutScores = scoreMapFromRows(DEFAULT_SHORTCUTS);
    }
  }

  // Always keep full module coverage — zeros sort last.
  for (const key of MODULE_ORDER) {
    if (modulesScores[key] == null) modulesScores[key] = 0;
  }

  const shortcutKeys = Object.keys(SHORTCUT_META);
  for (const key of shortcutKeys) {
    if (shortcutScores[key] == null) shortcutScores[key] = 0;
  }

  return {
    ...decorateSource(source, department, sampleSize),
    threshold: PERSONAL_THRESHOLD,
    sampleSize,
    personalSampleSize: personal.sampleSize,
    department,
    modules: rankedList(modulesScores, MODULE_ORDER, MODULE_META),
    shortcuts: rankedList(shortcutScores, shortcutKeys, SHORTCUT_META),
  };
}

module.exports = {
  PERSONAL_THRESHOLD,
  getPersonalizedModules,
};
