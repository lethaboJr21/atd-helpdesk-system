export const DASHBOARD_LAYOUTS = {
  "it-dashboard": {
    id: "it-dashboard",
    name: "IT Dashboard",
    workspace: "IT",
    sections: ["summaryGrid", "detailSections", "actionLists"],
    navType: "items",
    summaryGridSlots: ["openTickets", "slaAtRisk", "overdue", "resolvedToday", "avgResolutionTime", "repeatIssues"],
    detailSectionsSlots: ["priorityDistribution", "agentWorkload", "trends"],
    actionListsSlots: ["ageingTickets", "drilldown"],
  },
  "finance-employee": {
    id: "finance-employee",
    name: "Finance Employee Dashboard",
    workspace: "Finance",
    sections: ["summaryGrid", "detailSections", "actionLists"],
    navType: "groups",
    summaryGridSlots: ["pendingTasks", "overdueTasks", "completedToday", "kpiScore", "extensions", "exemptions"],
    detailSectionsSlots: ["journals", "reconciliations", "monthEnd"],
    actionListsSlots: ["emailAttention", "myKpi"],
  },
  "finance-manager": {
    id: "finance-manager",
    name: "Finance Manager Dashboard",
    workspace: "Finance",
    sections: ["summaryGrid", "detailSections", "actionLists"],
    navType: "groups",
    summaryGridSlots: ["teamWorkload", "overdueByEmployee", "awaitingReview", "reviewOverdue", "extensions", "kpiRisk"],
    detailSectionsSlots: ["qualitySummary", "timelinessSummary", "evidenceQueue"],
    actionListsSlots: ["actionShortcuts", "activityFeed"],
  },
  "employee": {
    id: "employee",
    name: "Employee Dashboard",
    workspace: "IT",
    sections: ["summaryGrid", "detailSections"],
    navType: "items",
    summaryGridSlots: ["openTickets", "recentActivity"],
    detailSectionsSlots: ["myTickets"],
  },
  "manager": {
    id: "manager",
    name: "Manager Dashboard",
    workspace: "IT",
    sections: ["summaryGrid", "detailSections", "actionLists"],
    navType: "items",
    summaryGridSlots: ["totalOpen", "byPriority", "byStatus", "slaCompliance"],
    detailSectionsSlots: ["teamPerformance", "ticketTrends"],
    actionListsSlots: ["escalations", "ageingTickets"],
  },
};

export function getLayoutDefinition(dashboardId) {
  return DASHBOARD_LAYOUTS[dashboardId] || null;
}

export function listRegisteredDashboards() {
  return Object.values(DASHBOARD_LAYOUTS);
}