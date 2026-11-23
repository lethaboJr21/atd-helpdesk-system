const { warnSchemaDrift } = require("../utils/schemaDriftWarning");

const WITH_KPI_SQL = `
  SELECT t.id,t.ticket_ref,t.title,t.status,t.priority,t.category,t.source,
         t.created_at,t.updated_at,t.due_at,t.assigned_to_user_id,t.assigned_group_id,
         u.name requester_name,a.name assignee_name,sg.name support_group_name,
         fo.finance_kpi_id,k.name finance_kpi_name,
         CASE WHEN t.status NOT IN ('Resolved','Closed')
                   AND t.due_at IS NOT NULL AND t.due_at<NOW()
              THEN TRUE ELSE FALSE END overdue,
         CASE WHEN t.status NOT IN ('Resolved','Closed')
                   AND t.assigned_to_user_id IS NULL
              THEN TRUE ELSE FALSE END unattended
  FROM tickets t
  LEFT JOIN users u ON u.id=t.requester_id
  LEFT JOIN users a ON a.id=t.assigned_to_user_id
  LEFT JOIN support_groups sg ON sg.id=t.assigned_group_id
  LEFT JOIN finance_ticket_operations fo ON fo.ticket_id=t.id
  LEFT JOIN finance_kpis k ON k.id=fo.finance_kpi_id
  WHERE t.workspace='FIN'
  ORDER BY t.created_at DESC,t.id DESC
  LIMIT 1000
`;

const WITHOUT_KPI_SQL = `
  SELECT t.id,t.ticket_ref,t.title,t.status,t.priority,t.category,t.source,
         t.created_at,t.updated_at,t.due_at,t.assigned_to_user_id,t.assigned_group_id,
         u.name requester_name,a.name assignee_name,sg.name support_group_name,
         NULL::bigint finance_kpi_id,NULL::text finance_kpi_name,
         CASE WHEN t.status NOT IN ('Resolved','Closed')
                   AND t.due_at IS NOT NULL AND t.due_at<NOW()
              THEN TRUE ELSE FALSE END overdue,
         CASE WHEN t.status NOT IN ('Resolved','Closed')
                   AND t.assigned_to_user_id IS NULL
              THEN TRUE ELSE FALSE END unattended
  FROM tickets t
  LEFT JOIN users u ON u.id=t.requester_id
  LEFT JOIN users a ON a.id=t.assigned_to_user_id
  LEFT JOIN support_groups sg ON sg.id=t.assigned_group_id
  WHERE t.workspace='FIN'
  ORDER BY t.created_at DESC,t.id DESC
  LIMIT 1000
`;

async function getFinanceReportingSummary(database) {
  try {
    const result = await database.query(WITH_KPI_SQL);
    return { tickets: result.rows, kpiLinkAvailable: true };
  } catch (error) {
    const missingKpiLinkColumn =
      error?.code === "42703" &&
      /column fo\.finance_kpi_id does not exist/i.test(String(error.message || ""));
    if (!missingKpiLinkColumn) throw error;

    warnSchemaDrift({
      route: "/api/finance-workspace/reporting-summary",
      table: "finance_ticket_operations",
      error,
    });
    const result = await database.query(WITHOUT_KPI_SQL);
    return { tickets: result.rows, kpiLinkAvailable: false };
  }
}

module.exports = { getFinanceReportingSummary };
