const pool = require("../db/pool");
const workspaceQueryService = require("./workspaceQueryService");

const SLA_AT_RISK_MINUTES = parseInt(process.env.IT_DASHBOARD_SLA_AT_RISK_MINUTES || "60", 10);
const AGEING_THRESHOLD_DAYS = parseInt(process.env.IT_DASHBOARD_AGEING_THRESHOLD_DAYS || "7", 10);

function rangeToInterval(range, customFrom, customTo) {
  if (range === "today") return ["NOW()::date", "NOW()"];
  if (range === "7d") return ["NOW() - INTERVAL '7 days'", "NOW()"];
  if (range === "30d") return ["NOW() - INTERVAL '30 days'", "NOW()"];
  if (range === "90d") return ["NOW() - INTERVAL '90 days'", "NOW()"];
  if (range === "custom" && customFrom && customTo) return [customFrom, customTo];
  return ["NOW() - INTERVAL '7 days'", "NOW()"];
}

function buildFilters(filters = {}) {
  const scope = workspaceQueryService.scopeTo("IT", { alias: "t" });
  const conditions = [scope.sql];
  const params = [...scope.params];
  if (filters.priority) { params.push(filters.priority); conditions.push(`t.priority=$${params.length}`); }
  if (filters.status) { params.push(filters.status); conditions.push(`t.status=$${params.length}`); }
  if (filters.agentId) { params.push(Number(filters.agentId)); conditions.push(`t.assigned_to_user_id=$${params.length}`); }
  if (filters.category) { params.push(filters.category); conditions.push(`t.category=$${params.length}`); }
  return { where: conditions.join(" AND "), params };
}

async function getMetrics(range = "7d", filters = {}, customFrom, customTo) {
  const [fromExpr, toExpr] = rangeToInterval(range, customFrom, customTo);
  const { where, params } = buildFilters(filters);
  const r = await pool.query(
    `SELECT
      COUNT(*) FILTER(WHERE t.status NOT IN('Resolved','Closed'))::int AS open_count,
      COUNT(*) FILTER(WHERE t.status='Assigned' OR t.status='In Progress')::int AS in_progress_count,
      COUNT(*) FILTER(WHERE t.status='Resolved')::int AS resolved_count,
      COUNT(*) FILTER(WHERE t.status='Closed')::int AS closed_count,
      COUNT(*) FILTER(WHERE t.due_at IS NOT NULL AND t.due_at < NOW() AND t.status NOT IN('Resolved','Closed'))::int AS sla_breached,
      COUNT(*) FILTER(WHERE t.due_at IS NOT NULL AND t.due_at > NOW() AND t.due_at < NOW() + INTERVAL '1 minute' * $${params.length + 1} AND t.status NOT IN('Resolved','Closed'))::int AS sla_at_risk,
      COUNT(*) FILTER(WHERE t.due_at IS NOT NULL AND t.due_at < NOW() AND t.status NOT IN('Resolved','Closed'))::int AS overdue_count,
      COUNT(*) FILTER(WHERE t.reopened = TRUE)::int AS reopened_count,
      COUNT(*)::int AS total_count
     FROM tickets t
     WHERE ${where} AND t.created_at >= ${fromExpr} AND t.created_at <= ${toExpr}`,
    [...params, SLA_AT_RISK_MINUTES]
  );
  const row = r.rows[0] || {};
  const total = Number(row.total_count || 0);
  const resolved = Number(row.resolved_count || 0);
  const reopened = Number(row.reopened_count || 0);
  const slaCompliance = total > 0 ? Math.round(((total - Number(row.sla_breached || 0)) / total) * 100) : 100;
  const reopenRate = resolved > 0 ? Math.round((reopened / resolved) * 100) : 0;
  const priority = await getPriorityDistribution(range, filters, customFrom, customTo);
  return {
    ticketVolume: { open: row.open_count, inProgress: row.in_progress_count, resolved: row.resolved_count, closed: row.closed_count },
    slaCompliance,
    slaAtRisk: row.sla_at_risk,
    slaBreached: row.sla_breached,
    slaBreachedAvgDurationMins: null,
    priorityDistribution: priority,
    reopenRate,
    ageingTicketCount: null,
    definitions: { slaAtRiskMinutes: SLA_AT_RISK_MINUTES, ageingThresholdDays: AGEING_THRESHOLD_DAYS },
  };
}

async function getPriorityDistribution(range = "7d", filters = {}, customFrom, customTo) {
  const [fromExpr, toExpr] = rangeToInterval(range, customFrom, customTo);
  const { where, params } = buildFilters(filters);
  const r = await pool.query(
    `SELECT t.priority, COUNT(*)::int count FROM tickets t
     WHERE ${where} AND t.created_at >= ${fromExpr} AND t.created_at <= ${toExpr}
     GROUP BY t.priority`,
    params
  );
  const dist = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  for (const row of r.rows) dist[row.priority] = Number(row.count);
  return dist;
}

async function getAgentWorkload(range = "7d") {
  const [fromExpr, toExpr] = rangeToInterval(range);
  const scope = workspaceQueryService.scopeTo("IT", { alias: "t" });
  const r = await pool.query(
    `SELECT t.assigned_to_user_id, u.name,
            COUNT(*) FILTER(WHERE t.status NOT IN('Resolved','Closed'))::int open_ticket_count,
            AVG(EXTRACT(EPOCH FROM (t.updated_at - t.created_at))/60)::numeric avg_handling_time_mins
     FROM tickets t
     LEFT JOIN users u ON u.id=t.assigned_to_user_id
     WHERE ${scope.sql}
       AND t.created_at >= ${fromExpr} AND t.created_at <= ${toExpr}
       AND t.assigned_to_user_id IS NOT NULL
     GROUP BY t.assigned_to_user_id, u.name`,
    scope.params
  );
  const agents = r.rows.map((x) => ({
    userId: x.assigned_to_user_id,
    name: x.name,
    openTicketCount: Number(x.open_ticket_count || 0),
    averageHandlingTimeMins: Math.round(Number(x.avg_handling_time_mins || 0)),
    slaCompliancePct: null,
    isOverloaded: false,
  }));
  const avgOpen = agents.length > 0 ? agents.reduce((s, a) => s + a.openTicketCount, 0) / agents.length : 0;
  for (const a of agents) a.isOverloaded = a.openTicketCount > avgOpen * 1.5;
  return agents;
}

async function getAgeingTickets(thresholdDays = AGEING_THRESHOLD_DAYS, range = "7d") {
  const [fromExpr, toExpr] = rangeToInterval(range);
  const scope = workspaceQueryService.scopeTo("IT", { alias: "t" });
  const r = await pool.query(
    `SELECT t.id, t.ticket_ref, t.title, t.status, t.assigned_to_user_id, u.name assignee_name,
            t.created_at, t.updated_at,
            EXTRACT(EPOCH FROM (NOW()-t.updated_at))/86400 age_in_days
     FROM tickets t
     LEFT JOIN users u ON u.id=t.assigned_to_user_id
     WHERE ${scope.sql}
       AND t.status NOT IN('Resolved','Closed')
       AND t.updated_at < NOW() - INTERVAL '1 day' * $2
       AND t.created_at >= ${fromExpr} AND t.created_at <= ${toExpr}
     ORDER BY age_in_days DESC`,
    [...scope.params, thresholdDays]
  );
  return r.rows.map((x) => ({ ...x, ageInDays: Math.round(Number(x.age_in_days)) }));
}

async function getTrends(range = "30d") {
  const [fromExpr, toExpr] = rangeToInterval(range);
  const scope = workspaceQueryService.scopeTo("IT", { alias: "t" });
  const r = await pool.query(
    `SELECT DATE(t.created_at) date,
            COUNT(*)::int volume,
            COUNT(*) FILTER(WHERE t.status='Resolved')::int resolved,
            COUNT(*) FILTER(WHERE t.due_at < NOW() AND t.status NOT IN('Resolved','Closed'))::int breached
     FROM tickets t
     WHERE ${scope.sql}
       AND t.created_at >= ${fromExpr} AND t.created_at <= ${toExpr}
     GROUP BY DATE(t.created_at)
     ORDER BY date`,
    scope.params
  );
  return r.rows.map((x) => ({
    date: x.date,
    volume: Number(x.volume),
    resolved: Number(x.resolved),
    breached: Number(x.breached),
  }));
}

async function getDrilldown(metric, range = "7d", filters = {}) {
  const [fromExpr, toExpr] = rangeToInterval(range, filters.customFrom, filters.customTo);
  const { where, params } = buildFilters(filters);
  let extraCondition = "";
  if (metric === "sla_breached") extraCondition = "AND t.due_at < NOW() AND t.status NOT IN('Resolved','Closed')";
  else if (metric === "sla_at_risk") extraCondition = `AND t.due_at > NOW() AND t.due_at < NOW() + INTERVAL '1 minute' * ${SLA_AT_RISK_MINUTES} AND t.status NOT IN('Resolved','Closed')`;
  else if (metric === "open") extraCondition = "AND t.status NOT IN('Resolved','Closed')";
  else if (metric === "overdue") extraCondition = "AND t.due_at < NOW() AND t.status NOT IN('Resolved','Closed')";
  const r = await pool.query(
    `SELECT t.id, t.ticket_ref, t.title, t.status, t.priority, t.due_at, t.assigned_to_user_id, u.name assignee_name
     FROM tickets t
     LEFT JOIN users u ON u.id=t.assigned_to_user_id
     WHERE ${where} ${extraCondition} AND t.created_at >= ${fromExpr} AND t.created_at <= ${toExpr}
     ORDER BY t.created_at DESC LIMIT 200`,
    params
  );
  return r.rows;
}

async function getTaskQueue(filters = {}) {
  const scope = workspaceQueryService.scopeTo("IT", { alias: "t" });
  const conditions = [scope.sql, "t.status NOT IN('Resolved','Closed')"];
  const params = [...scope.params];

  if (filters.priority) {
    params.push(filters.priority);
    conditions.push(`t.priority=$${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`t.status=$${params.length}`);
  }
  if (filters.agentId === "unassigned") {
    conditions.push("t.assigned_to_user_id IS NULL");
  } else if (filters.agentId) {
    const agentId = Number(filters.agentId);
    if (!Number.isInteger(agentId) || agentId <= 0) {
      throw Object.assign(new Error("Invalid assignee filter."), { status: 400 });
    }
    params.push(agentId);
    conditions.push(`t.assigned_to_user_id=$${params.length}`);
  }
  if (filters.category) {
    params.push(filters.category);
    conditions.push(`t.category=$${params.length}`);
  }

  params.push(SLA_AT_RISK_MINUTES);
  const slaThresholdIndex = params.length;
  params.push(100);
  const limitIndex = params.length;
  const result = await pool.query(
    `SELECT t.id, t.ticket_ref, t.title, t.status, t.priority, t.category,
            t.due_at, t.created_at, t.assigned_to_user_id, t.assigned_group_id,
            u.name AS assignee_name, g.name AS assigned_group_name,
            (t.due_at IS NOT NULL AND t.due_at < NOW()) AS is_overdue,
            (t.due_at IS NOT NULL AND t.due_at >= NOW()
              AND t.due_at < NOW() + INTERVAL '1 minute' * $${slaThresholdIndex}) AS is_sla_at_risk,
            COUNT(*) OVER()::int AS total_count
     FROM tickets t
     LEFT JOIN users u ON u.id=t.assigned_to_user_id
     LEFT JOIN support_groups g ON g.id=t.assigned_group_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY
       CASE
         WHEN t.due_at IS NOT NULL AND t.due_at < NOW() THEN 0
         WHEN t.due_at IS NOT NULL
           AND t.due_at < NOW() + INTERVAL '1 minute' * $${slaThresholdIndex} THEN 1
         WHEN t.priority='Critical' THEN 2
         WHEN t.priority='High' THEN 3
         WHEN t.priority='Medium' THEN 4
         ELSE 5
       END,
       t.due_at ASC NULLS LAST,
       t.created_at ASC
     LIMIT $${limitIndex}`,
    params
  );
  const tickets = result.rows.map(({ total_count, ...ticket }) => ticket);
  return {
    tickets,
    total: Number(result.rows[0]?.total_count || 0),
    limit: 100,
  };
}

module.exports = {
  getMetrics,
  getAgentWorkload,
  getAgeingTickets,
  getTrends,
  getPriorityDistribution,
  getDrilldown,
  getTaskQueue,
};