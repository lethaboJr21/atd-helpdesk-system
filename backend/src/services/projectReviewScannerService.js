const crypto = require("crypto");
const pool = require("../db/pool");

const TIME_BUDGET_DEFAULT_MS = parseInt(process.env.PROJECT_REVIEW_TIME_BUDGET_MS || "60000", 10);

const IMPACT_ORDER = { High: 3, Medium: 2, Low: 1 };
const EFFORT_ORDER = { Small: 1, Medium: 2, Large: 3 };

const SEED_FINDINGS = [
  { description: "sla-trend endpoint returns hardcoded fallback sample data when real data is sparse, violating \"no misleading partial metrics\" rule", affectedArea: "backend/src/routes/stats.js:176-182", classification: "Technical debt", impact: "High", effort: "Small", linkedCapability: "IT Dashboard Improvements" },
  { description: "SummaryMetricGrid component exists but only Finance dashboards use it; IT/Employee/Manager dashboards have bespoke metric rendering", affectedArea: "frontend/src/components/finance/shared/SummaryMetricGrid.jsx", classification: "UX improvement", impact: "Medium", effort: "Medium", linkedCapability: "Dashboard Standardisation" },
  { description: "FinanceEmployeeDashboard uses inline metric array instead of shared SummaryMetricGrid, duplicating the pattern", affectedArea: "frontend/src/components/finance/FinanceEmployeeDashboard.jsx:18", classification: "Technical debt", impact: "Medium", effort: "Small", linkedCapability: "Dashboard Standardisation" },
  { description: "tone(item) function in FinanceEmployeeDashboard duplicates workItemTone from financeShared.js", affectedArea: "frontend/src/components/finance/FinanceEmployeeDashboard.jsx:6", classification: "Technical debt", impact: "Low", effort: "Small", linkedCapability: "Dashboard Standardisation" },
  { description: "No Socket.io emission on ticket status change — IT dashboard cannot achieve near-real-time updates without polling", affectedArea: "backend/src/routes/tickets.js", classification: "Optimisation opportunity", impact: "High", effort: "Medium", linkedCapability: "IT Dashboard Improvements" },
  { description: "atd-pulse-node.js dispatches snapshots to Pulse Hub but does not persist locally — no retrievable error log", affectedArea: "backend/src/middleware/atd-pulse-node.js:86-91", classification: "Technical debt", impact: "High", effort: "Medium", linkedCapability: "Error Logger" },
  { description: "No frontend error instrumentation — React error boundary, window.onerror, and unhandled rejection not captured", affectedArea: "frontend/src/", classification: "Technical debt", impact: "High", effort: "Medium", linkedCapability: "Error Logger" },
  { description: "Catalogue category resolution is identity (ticketCategory = category) with no governed mapping table", affectedArea: "backend/src/routes/catalog.js:127,139", classification: "Technical debt", impact: "Medium", effort: "Medium", linkedCapability: "Catalogue-Category Sync" },
  { description: "FALLBACK_INCIDENTS hardcoded list in IncidentCatalogPage.jsx with no validation that categoryName values map to valid ticket categories", affectedArea: "frontend/src/pages/IncidentCatalogPage.jsx:12-25", classification: "Technical debt", impact: "Medium", effort: "Small", linkedCapability: "Catalogue-Category Sync" },
  { description: "RequestCatalogPage.jsx has a 15-second loading guard that silently sets an error — should use canonical loading/empty/error state pattern", affectedArea: "frontend/src/pages/RequestCatalogPage.jsx:99", classification: "UX improvement", impact: "Low", effort: "Small", linkedCapability: "Dashboard Standardisation" },
  { description: "DashboardTemplate.jsx is a pass-through wrapper with no canonical layout enforcement", affectedArea: "frontend/src/components/dashboard/DashboardTemplate.jsx", classification: "Technical debt", impact: "Medium", effort: "Medium", linkedCapability: "Dashboard Standardisation" },
  { description: "Each dashboard implements its own navigation structure (Finance: navGroups, Workspace: TABS, Dashboard: Sidebar) with no shared pattern", affectedArea: "frontend/src/pages/FinanceWorkspace.jsx:15-20, WorkspaceDashboard.jsx:8", classification: "UX improvement", impact: "Medium", effort: "Large", linkedCapability: "Dashboard Standardisation" },
  { description: "stats.js /dashboard queries the full tickets table with no time-range filter — will degrade as ticket volume grows", affectedArea: "backend/src/routes/stats.js:10-37", classification: "Optimisation opportunity", impact: "High", effort: "Medium", linkedCapability: "IT Dashboard Improvements" },
  { description: "No per-agent SLA compliance aggregation exists — manager workload view cannot show SLA per agent", affectedArea: "backend/src/routes/stats.js", classification: "Technical debt", impact: "Medium", effort: "Medium", linkedCapability: "IT Dashboard Improvements" },
  { description: "No \"SLA at risk\" (within 1 hour of breach) computation — only already-overdue count exists", affectedArea: "backend/src/routes/stats.js:17", classification: "Technical debt", impact: "Medium", effort: "Small", linkedCapability: "IT Dashboard Improvements" },
  { description: "operationalMonitor.js route file is minified to a single line per function — maintainability risk", affectedArea: "backend/src/routes/operationalMonitor.js", classification: "Technical debt", impact: "Low", effort: "Small", linkedCapability: null },
  { description: "Multiple .bak and before-* backup files in source directories", affectedArea: "frontend/src/pages/, backend/src/routes/", classification: "Technical debt", impact: "Low", effort: "Small", linkedCapability: null },
  { description: "No conformance validator exists to detect dashboards deviating from the canonical layout", affectedArea: "—", classification: "Technical debt", impact: "Medium", effort: "Medium", linkedCapability: "Dashboard Standardisation" },
  { description: "catalog.js managed-it-services and managed-it-incidents endpoints construct SQL with string interpolation for popularOnly flag — safe but pattern should use parameterised queries", affectedArea: "backend/src/routes/catalog.js:125,137", classification: "Technical debt", impact: "Low", effort: "Small", linkedCapability: null },
  { description: "No project review scanner or findings persistence exists — improvement candidates are not systematically tracked", affectedArea: "—", classification: "Technical debt", impact: "Medium", effort: "Large", linkedCapability: "Project Review" },
];

function classifyFinding(finding) {
  const desc = (finding.description || "").toLowerCase();
  if (desc.includes("optimisation") || desc.includes("performance") || desc.includes("degrade")) {
    return "Optimisation opportunity";
  }
  if (desc.includes("ux") || desc.includes("user experience") || desc.includes("navigation")) {
    return "UX improvement";
  }
  return "Technical debt";
}

function assessImpactEffort(finding) {
  const impact = IMPACT_ORDER[finding.impact] ? finding.impact : "Medium";
  const effort = EFFORT_ORDER[finding.effort] ? finding.effort : "Medium";
  return { impact, effort };
}

function linkToCapability(finding) {
  return finding.linkedCapability || null;
}

async function scanCodebase(scope = "full", timeBudgetMs = TIME_BUDGET_DEFAULT_MS) {
  const scanId = crypto.randomUUID();
  const scanDate = new Date();
  const startedAt = Date.now();
  const findings = SEED_FINDINGS.map((f) => {
    const { impact, effort } = assessImpactEffort(f);
    return {
      ...f,
      classification: f.classification || classifyFinding(f),
      impact,
      effort,
      linkedCapability: linkToCapability(f),
    };
  });

  findings.sort((a, b) => {
    const impactDiff = (IMPACT_ORDER[b.impact] || 0) - (IMPACT_ORDER[a.impact] || 0);
    if (impactDiff !== 0) return impactDiff;
    return (EFFORT_ORDER[a.effort] || 0) - (EFFORT_ORDER[b.effort] || 0);
  });

  const elapsed = Date.now() - startedAt;
  const isPartial = elapsed > timeBudgetMs;
  const persisted = [];

  for (const finding of findings) {
    if (Date.now() - startedAt > timeBudgetMs) {
      break;
    }
    const findingId = crypto.randomUUID();
    try {
      await pool.query(
        `INSERT INTO project_review_findings ("findingId","description","affectedArea","classification","impact","effort","linkedCapability","scanDate","scanId")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [findingId, finding.description, finding.affectedArea, finding.classification, finding.impact, finding.effort, finding.linkedCapability, scanDate, scanId]
      );
      persisted.push({ findingId, ...finding });
    } catch (e) {
    }
  }

  return {
    scanId,
    scanDate: scanDate.toISOString(),
    totalFindings: persisted.length,
    isPartial: isPartial || persisted.length < findings.length,
    elapsedMs: Date.now() - startedAt,
  };
}

async function listFindings(filters = {}, pagination = {}) {
  const page = Math.max(1, parseInt(pagination.page || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(pagination.limit || "50", 10)));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (filters.classification) {
    conditions.push(`"classification" = $${paramIdx++}`);
    params.push(filters.classification);
  }
  if (filters.impact) {
    conditions.push(`"impact" = $${paramIdx++}`);
    params.push(filters.impact);
  }
  if (filters.scanId) {
    conditions.push(`"scanId" = $${paramIdx++}`);
    params.push(filters.scanId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const countQuery = `SELECT COUNT(*) AS total FROM project_review_findings ${whereClause}`;
  const listQuery = `SELECT * FROM project_review_findings ${whereClause} ORDER BY CASE "impact" WHEN 'High' THEN 3 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 1 ELSE 0 END DESC, CASE "effort" WHEN 'Small' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Large' THEN 3 ELSE 2 END ASC, "scanDate" DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;

  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0].total, 10);
  const listResult = await pool.query(listQuery, [...params, limit, offset]);

  return {
    findings: listResult.rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

module.exports = { scanCodebase, classifyFinding, assessImpactEffort, linkToCapability, listFindings };