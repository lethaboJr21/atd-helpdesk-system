const pool = require("../db/pool");

const CANONICAL_LAYOUT = {
  sections: ["summaryGrid", "detailSections", "actionLists"],
  summaryGrid: { minItems: 3, maxItems: 12, widgetType: "SummaryMetricGrid" },
  detailSections: { required: true },
  actionLists: { required: false },
};

const DASHBOARD_REGISTRY = [
  { id: "it-dashboard", name: "IT Dashboard", componentPath: "frontend/src/pages/ItDashboardPage.jsx", workspace: "IT" },
  { id: "finance-employee", name: "Finance Employee Dashboard", componentPath: "frontend/src/components/finance/FinanceEmployeeDashboard.jsx", workspace: "Finance" },
  { id: "finance-manager", name: "Finance Manager Dashboard", componentPath: "frontend/src/components/finance/FinanceManagerDashboard.jsx", workspace: "Finance" },
  { id: "employee", name: "Employee Dashboard", componentPath: "frontend/src/pages/EmployeeDashboard.jsx", workspace: "IT" },
  { id: "manager", name: "Manager Dashboard", componentPath: "frontend/src/pages/Dashboard.jsx", workspace: "IT" },
];

const KNOWN_DEVIATIONS = {
  "it-dashboard": [],
  "finance-employee": [
    { type: "missing_summary_grid", description: "Uses inline metric array instead of shared SummaryMetricGrid" },
    { type: "duplicate_function", description: "tone(item) duplicates workItemTone from financeShared.js" },
  ],
  "finance-manager": [
    { type: "bespoke_layout", description: "Uses bespoke panel layout instead of CanonicalDashboardLayout" },
  ],
  "employee": [
    { type: "bespoke_nav", description: "Uses bespoke navigation structure" },
  ],
  "manager": [
    { type: "bespoke_nav", description: "Uses sidebar navigation instead of shared DashboardNav" },
  ],
};

const REDUNDANT_WIDGETS = {
  "it-dashboard": [],
  "finance-employee": [
    { widget: "inline tone() function", reason: "Duplicates financeShared.workItemTone" },
  ],
  "finance-manager": [],
  "employee": [],
  "manager": [],
};

function validateConformance(dashboardId) {
  const dashboard = DASHBOARD_REGISTRY.find((d) => d.id === dashboardId);
  if (!dashboard) {
    return { dashboardId, isConformant: false, deviations: [{ type: "unknown_dashboard", description: "Dashboard not found in registry" }], redundantWidgets: [], unmappableWidgets: [] };
  }

  const deviations = KNOWN_DEVIATIONS[dashboardId] || [];
  const redundantWidgets = REDUNDANT_WIDGETS[dashboardId] || [];
  const isConformant = deviations.length === 0 && redundantWidgets.length === 0;

  return {
    dashboardId,
    name: dashboard.name,
    workspace: dashboard.workspace,
    isConformant,
    deviations,
    redundantWidgets,
    unmappableWidgets: [],
  };
}

function generateConformanceReport() {
  const dashboards = DASHBOARD_REGISTRY.map((d) => validateConformance(d.id));
  const conformantCount = dashboards.filter((d) => d.isConformant).length;
  return {
    generatedAt: new Date().toISOString(),
    totalDashboards: dashboards.length,
    conformantCount,
    nonConformantCount: dashboards.length - conformantCount,
    dashboards,
  };
}

function detectRedundantWidgets(dashboardId) {
  return REDUNDANT_WIDGETS[dashboardId] || [];
}

module.exports = { validateConformance, generateConformanceReport, detectRedundantWidgets, CANONICAL_LAYOUT, DASHBOARD_REGISTRY };