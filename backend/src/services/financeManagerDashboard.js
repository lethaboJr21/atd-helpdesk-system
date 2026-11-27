const pool = require("../db/pool");

const TARGET_KPI_SCORE = 80;

async function getTeamStaff(period) {
  const r = await pool.query(
    `SELECT u.id,u.name,u.email,u.job_title,u.department,
            r.finance_function,r.manager_user_id,r.backup_user_id,
            r.availability_status,r.delegation_eligible,r.is_finance_manager,r.active,
            mu.name manager_name,bu.name backup_name,
            COALESCE(w.open_work,0)::int open_work,
            COALESCE(w.overdue_work,0)::int overdue_work,
            COALESCE(d.duty_progress,0)::numeric duty_progress,
            COALESCE(k.kpi_progress,0)::numeric kpi_progress
     FROM users u
     JOIN finance_employee_responsibilities r ON r.user_id=u.id
     LEFT JOIN users mu ON mu.id=r.manager_user_id
     LEFT JOIN users bu ON bu.id=r.backup_user_id
     LEFT JOIN LATERAL(
       SELECT COUNT(*) FILTER(WHERE t.status NOT IN('Resolved','Closed')) open_work,
              COUNT(*) FILTER(WHERE COALESCE(t.effective_due_at,t.due_at)<NOW() AND t.status NOT IN('Resolved','Closed')) overdue_work
       FROM tickets t WHERE t.assigned_to_user_id=u.id AND t.workspace='FIN'
     ) w ON TRUE
     LEFT JOIN LATERAL(
       SELECT ROUND(COALESCE(SUM(weight*progress_percent)/NULLIF(SUM(weight),0),0),2) duty_progress
       FROM finance_employee_duties d WHERE d.user_id=u.id
     ) d ON TRUE
     LEFT JOIN LATERAL(
       SELECT ROUND(COALESCE(SUM(weight*progress_percent)/NULLIF(SUM(weight),0),AVG(progress_percent),0),2) kpi_progress
       FROM finance_kpis k WHERE k.owner_user_id=u.id
         AND TO_CHAR(k.period_start,'YYYY-MM')<=$1 AND TO_CHAR(k.period_end,'YYYY-MM')>=$1
     ) k ON TRUE
     WHERE u.archived_at IS NULL AND u.status='active' AND r.active=TRUE
     ORDER BY u.name`,
    [period]
  );
  return r.rows;
}

async function getSummary() {
  const r = await pool.query(
    `SELECT COUNT(*)::int active_staff,
            COUNT(*) FILTER(WHERE manager_user_id IS NULL)::int missing_manager,
            COUNT(*) FILTER(WHERE backup_user_id IS NULL)::int missing_backup
     FROM finance_employee_responsibilities WHERE active=TRUE`
  );
  const close = await pool.query(
    `SELECT ROUND(COALESCE(SUM(t.weight*t.progress_percent)/NULLIF(SUM(t.weight),0),0),2) progress,
            COUNT(*) FILTER(WHERE t.due_at<NOW() AND t.status NOT IN('completed','closed'))::int overdue,
            COUNT(*) FILTER(WHERE t.status NOT IN('completed','closed'))::int outstanding
     FROM finance_close_tasks t
     JOIN finance_close_periods p ON p.id=t.period_id
     WHERE p.period_key=TO_CHAR(NOW(),'YYYY-MM')`
  );
  return {
    ...r.rows[0],
    closeProgress: Number(close.rows[0].progress || 0),
    closeOverdue: close.rows[0].overdue,
    closeOutstanding: close.rows[0].outstanding,
  };
}

async function getOverdueByEmployee() {
  const r = await pool.query(
    `SELECT t.assigned_to_user_id userId,
            u.name,
            t.id workItemId,
            t.ticket_ref reference,
            t.title,
            t.priority,
            COALESCE(t.category, t.workspace, 'Finance') financeFunction,
            COALESCE(t.effective_due_at,t.due_at) dueAt,
            EXTRACT(EPOCH FROM (NOW()-COALESCE(t.effective_due_at,t.due_at)))/86400 ageDays,
            CASE WHEN EXTRACT(EPOCH FROM (NOW()-COALESCE(t.effective_due_at,t.due_at)))/86400 > 7 THEN 'critical'
                 WHEN EXTRACT(EPOCH FROM (NOW()-COALESCE(t.effective_due_at,t.due_at)))/86400 > 3 THEN 'high'
                 ELSE 'normal' END escalationLevel
     FROM tickets t
     JOIN users u ON u.id=t.assigned_to_user_id
     WHERE t.workspace='FIN'
       AND COALESCE(t.effective_due_at,t.due_at)<NOW()
       AND t.status NOT IN('Resolved','Closed')
     ORDER BY ageDays DESC`
  );
  const byEmployee = {};
  for (const row of r.rows) {
    const key = row.userid;
    if (!byEmployee[key]) {
      byEmployee[key] = { userId: key, name: row.name, items: [] };
    }
    byEmployee[key].items.push({
      workItemId: row.workitemid,
      reference: row.reference,
      title: row.title,
      priority: row.priority,
      ageDays: Math.round(Number(row.agedays)),
      escalationLevel: row.escalationlevel,
      financeFunction: row.financefunction,
    });
  }
  return Object.values(byEmployee);
}

async function getReviewQueues() {
  const [awaiting, overdue] = await Promise.all([
    pool.query(
      `SELECT t.id workItemId,t.ticket_ref reference,t.title,
              sub.name submitterName,COALESCE(t.created_at, NOW()) submitted_at,
              COALESCE(t.category, t.workspace, 'Finance') financeFunction,
              t.priority,COALESCE(t.effective_due_at, t.due_at) review_deadline,
              EXTRACT(EPOCH FROM (NOW()-t.created_at))/86400 agingDays
       FROM tickets t
       JOIN finance_ticket_operations fto ON fto.ticket_id=t.id
       JOIN users sub ON sub.id=t.assigned_to_user_id
       WHERE t.workspace='FIN'
         AND fto.review_state='awaiting_review'
         AND t.status NOT IN('Resolved','Closed')
       ORDER BY t.created_at DESC`
    ),
    pool.query(
      `SELECT t.id workItemId,t.ticket_ref reference,t.title,
              rv.name assignedReviewerName,COALESCE(t.effective_due_at, t.due_at) review_deadline,
              EXTRACT(EPOCH FROM (NOW()-COALESCE(t.effective_due_at, t.due_at)))/86400 agePastDeadlineDays,
              COALESCE(t.category, t.workspace, 'Finance') financeFunction
       FROM tickets t
       JOIN finance_ticket_operations fto ON fto.ticket_id=t.id
       LEFT JOIN users rv ON rv.id=t.assigned_to_user_id
       WHERE t.workspace='FIN'
         AND fto.review_state='awaiting_review'
         AND COALESCE(t.effective_due_at, t.due_at) IS NOT NULL
         AND COALESCE(t.effective_due_at, t.due_at)<NOW()
         AND t.status NOT IN('Resolved','Closed')
       ORDER BY agePastDeadlineDays DESC`
    ),
  ]);
  return {
    awaitingReview: awaiting.rows.map((x) => ({
      ...x,
      agingDays: Math.round(Number(x.agingdays)),
    })),
    reviewOverdue: overdue.rows.map((x) => ({
      ...x,
      agePastDeadlineDays: Math.round(Number(x.agepastdeadlinedays)),
    })),
  };
}

async function getEvidenceQueue() {
  const r = await pool.query(
    `SELECT e.id,e.record_type workItemType,e.record_id workItemId,
            COALESCE(e.title,e.file_name,e.evidence_reference,'Evidence #' || e.id) title,
            COALESCE(e.evidence_reference, '') evidenceDescription,
            e.review_status evidenceState,
            u.name assigneeName,
            EXTRACT(EPOCH FROM (NOW()-e.uploaded_at))/86400 agingDays
     FROM finance_record_evidence e
     LEFT JOIN users u ON u.id=e.uploaded_by
     ORDER BY e.uploaded_at DESC`
  );
  const partitions = { required: [], submitted: [], returned: [] };
  for (const row of r.rows) {
    const item = {
      workItemId: row.workitemid,
      workItemType: row.workitemtype,
      title: row.title,
      assigneeName: row.assigneename,
      evidenceDescription: row.evidencedescription,
      agingDays: Math.round(Number(row.agingdays)),
    };
    if (row.evidencestate === "returned") partitions.returned.push(item);
    else if (row.evidencestate === "approved") partitions.submitted.push(item);
    else partitions.required.push(item);
  }
  return partitions;
}

async function getExtensionsWithChains() {
  const pending = await pool.query(
    `SELECT er.id,er.work_item_id,er.work_item_type,
            er.requested_due_at,er.reason,er.dependency_type,
            er.status,
            u.name requesterName,
            COALESCE(t.ticket_ref,j.journal_reference,rc.reconciliation_reference,ct.task_reference) reference
     FROM finance_extension_requests er
     LEFT JOIN users u ON u.id=er.requested_by
     LEFT JOIN tickets t ON t.id=er.work_item_id AND er.work_item_type='ticket'
     LEFT JOIN finance_journals j ON j.id=er.work_item_id AND er.work_item_type='journal'
     LEFT JOIN finance_reconciliations rc ON rc.id=er.work_item_id AND er.work_item_type='reconciliation'
     LEFT JOIN finance_close_tasks ct ON ct.id=er.work_item_id AND er.work_item_type='month_end'
     WHERE er.status='pending'
     ORDER BY er.created_at DESC`
  );
  const approved = await pool.query(
    `SELECT er.id,er.work_item_id,er.work_item_type,
            er.requested_due_at,er.approved_due_at,er.reason,
            u.name requesterName,
            COALESCE(t.ticket_ref,j.journal_reference,rc.reconciliation_reference,ct.task_reference) reference
     FROM finance_extension_requests er
     LEFT JOIN users u ON u.id=er.requested_by
     LEFT JOIN tickets t ON t.id=er.work_item_id AND er.work_item_type='ticket'
     LEFT JOIN finance_journals j ON j.id=er.work_item_id AND er.work_item_type='journal'
     LEFT JOIN finance_reconciliations rc ON rc.id=er.work_item_id AND er.work_item_type='reconciliation'
     LEFT JOIN finance_close_tasks ct ON ct.id=er.work_item_id AND er.work_item_type='month_end'
     WHERE er.status='approved'
     ORDER BY COALESCE(er.decided_at, er.updated_at, er.created_at) DESC`
  );
  return {
    pendingExtensions: pending.rows,
    approvedExtensions: approved.rows,
  };
}

async function getQualitySummary(period) {
  const [perEmployee, perObjective] = await Promise.all([
    pool.query(
      `SELECT s.reviewer_user_id userId,
              u.name,
              AVG(s.quality_score)::numeric averageQuality
       FROM finance_kpi_item_scores s
       LEFT JOIN users u ON u.id=s.reviewer_user_id
       WHERE s.period_key=$1 AND s.reviewer_user_id IS NOT NULL
       GROUP BY s.reviewer_user_id,u.name
       ORDER BY averageQuality DESC`,
      [period]
    ),
    pool.query(
      `SELECT s.objective_name objectiveName,
              AVG(s.quality_score)::numeric averageQuality
       FROM finance_kpi_item_scores s
       WHERE s.period_key=$1
       GROUP BY s.objective_name
       ORDER BY averageQuality DESC`,
      [period]
    ),
  ]);
  return {
    perEmployee: perEmployee.rows.map((x) => ({
      userId: x.userid,
      name: x.name,
      averageQuality: Number(x.averagequality || 0),
    })),
    perObjective: perObjective.rows.map((x) => ({
      objectiveName: x.objectivename,
      averageQuality: Number(x.averagequality || 0),
    })),
  };
}

async function getTimelinessSummary(period) {
  const [perEmployee, perObjective] = await Promise.all([
    pool.query(
      `SELECT s.reviewer_user_id userId,
              u.name,
              AVG(s.timeliness_score)::numeric timelinessPercent
       FROM finance_kpi_item_scores s
       LEFT JOIN users u ON u.id=s.reviewer_user_id
       WHERE s.period_key=$1 AND s.reviewer_user_id IS NOT NULL
       GROUP BY s.reviewer_user_id,u.name
       ORDER BY timelinessPercent DESC`,
      [period]
    ),
    pool.query(
      `SELECT s.objective_name objectiveName,
              AVG(s.timeliness_score)::numeric averageTimeliness
       FROM finance_kpi_item_scores s
       WHERE s.period_key=$1
       GROUP BY s.objective_name
       ORDER BY averageTimeliness DESC`,
      [period]
    ),
  ]);
  return {
    perEmployee: perEmployee.rows.map((x) => ({
      userId: x.userid,
      name: x.name,
      timelinessPercent: Number(x.timelinesspercent || 0),
    })),
    perObjective: perObjective.rows.map((x) => ({
      objectiveName: x.objectivename,
      averageTimeliness: Number(x.averagetimeliness || 0),
    })),
  };
}

async function getKpiRisk(period) {
  const employeeScores = await pool.query(
    `SELECT s.reviewer_user_id userId,
            u.name,
            AVG(s.item_score)::numeric projectedScore
     FROM finance_kpi_item_scores s
     LEFT JOIN users u ON u.id=s.reviewer_user_id
     WHERE s.period_key=$1 AND s.reviewer_user_id IS NOT NULL
     GROUP BY s.reviewer_user_id,u.name`,
    [period]
  );
  const atRiskEmployees = employeeScores.rows
    .filter((x) => Number(x.projectedscore || 0) < TARGET_KPI_SCORE)
    .map((x) => ({
      userId: x.userid,
      name: x.name,
      projectedScore: Number(x.projectedscore || 0),
      targetScore: TARGET_KPI_SCORE,
      shortfall: TARGET_KPI_SCORE - Number(x.projectedscore || 0),
    }));

  const portfolioScores = await pool.query(
    `SELECT COALESCE(t.category, t.workspace, 'General Finance Administration') portfolio,
            AVG(s.item_score)::numeric projectedScore
     FROM finance_kpi_item_scores s
     LEFT JOIN tickets t ON t.id=s.work_item_id AND s.work_item_type='ticket'
     WHERE s.period_key=$1
     GROUP BY COALESCE(t.category, t.workspace, 'General Finance Administration')`,
    [period]
  );
  const atRiskPortfolios = portfolioScores.rows
    .filter((x) => Number(x.projectedscore || 0) < TARGET_KPI_SCORE)
    .map((x) => ({
      portfolio: x.portfolio,
      projectedScore: Number(x.projectedscore || 0),
      targetScore: TARGET_KPI_SCORE,
      shortfall: TARGET_KPI_SCORE - Number(x.projectedscore || 0),
    }));

  return { atRiskEmployees, atRiskPortfolios };
}

async function getActivityFeedPreview(managerUserId) {
  const r = await pool.query(
    `SELECT a.actor_user_id,
            a.action AS action_type,
            a.record_id AS work_item_id,
            COALESCE(a.detail->>'reference', a.record_type || '-' || a.record_id) AS work_item_reference,
            COALESCE(a.detail->>'title', a.reason, a.action) AS work_item_title,
            COALESCE(a.detail->>'detail', a.reason, '') AS action_detail,
            a.created_at AS action_timestamp,
            COALESCE(a.detail->>'function', 'Finance') AS finance_function,
            u.name AS actorName
     FROM finance_governance_actions a
     LEFT JOIN users u ON u.id=a.actor_user_id
     WHERE a.actor_user_id IN (
       SELECT user_id FROM finance_employee_responsibilities
       WHERE (manager_user_id=$1 OR $1 IS NULL) AND active=TRUE
     )
     ORDER BY a.created_at DESC
     LIMIT 20`,
    [managerUserId]
  );
  return r.rows;
}

async function buildManagerDashboard({ managerUserId, period }) {
  const errors = [];
  const safe = async (name, fn) => {
    try {
      return await fn();
    } catch (err) {
      errors.push({ group: name, error: err.message });
      return null;
    }
  };

  const [staff, summary, overdueByEmployee, reviewQueues, evidenceQueue, extensions, qualitySummary, timelinessSummary, kpiRisk, activityFeedPreview] = await Promise.all([
    safe("staff", () => getTeamStaff(period)),
    safe("summary", () => getSummary()),
    safe("overdueByEmployee", () => getOverdueByEmployee()),
    safe("reviewQueues", () => getReviewQueues()),
    safe("evidenceQueue", () => getEvidenceQueue()),
    safe("extensions", () => getExtensionsWithChains()),
    safe("qualitySummary", () => getQualitySummary(period)),
    safe("timelinessSummary", () => getTimelinessSummary(period)),
    safe("kpiRisk", () => getKpiRisk(period)),
    safe("activityFeed", () => getActivityFeedPreview(managerUserId)),
  ]);

  const enrichedStaff = (staff || []).map((emp) => {
    const overdueEmp = (overdueByEmployee || []).find((x) => String(x.userId) === String(emp.id));
    const qualityEmp = (qualitySummary?.perEmployee || []).find((x) => String(x.userId) === String(emp.id));
    const timelinessEmp = (timelinessSummary?.perEmployee || []).find((x) => String(x.userId) === String(emp.id));
    const riskEmp = (kpiRisk?.atRiskEmployees || []).find((x) => String(x.userId) === String(emp.id));
    return {
      ...emp,
      overdueItems: overdueEmp?.items || [],
      qualityRating: qualityEmp?.averageQuality || null,
      timelinessPercent: timelinessEmp?.timelinessPercent || null,
      kpiRiskFlag: !!riskEmp,
      projectedScore: riskEmp?.projectedScore || null,
    };
  });

  const enrichedSummary = {
    ...(summary || {}),
    totalOverdue: (overdueByEmployee || []).reduce((sum, x) => sum + x.items.length, 0),
    totalAwaitingReview: reviewQueues?.awaitingReview?.length || 0,
    totalReviewOverdue: reviewQueues?.reviewOverdue?.length || 0,
    totalEvidenceRequired: evidenceQueue?.required?.length || 0,
    totalPendingExtensions: extensions?.pendingExtensions?.length || 0,
  };

  return {
    staff: enrichedStaff,
    summary: enrichedSummary,
    overdueByEmployee: overdueByEmployee || [],
    reviewQueues: reviewQueues || { awaitingReview: [], reviewOverdue: [] },
    evidenceQueue: evidenceQueue || { required: [], submitted: [], returned: [] },
    extensionsWithChains: extensions || { pendingExtensions: [], approvedExtensions: [] },
    qualitySummary: qualitySummary || { perEmployee: [], perObjective: [] },
    timelinessSummary: timelinessSummary || { perEmployee: [], perObjective: [] },
    kpiRisk: kpiRisk || { atRiskEmployees: [], atRiskPortfolios: [] },
    activityFeedPreview: activityFeedPreview || [],
    _errors: errors.length ? errors : undefined,
  };
}

module.exports = { buildManagerDashboard, TARGET_KPI_SCORE };

