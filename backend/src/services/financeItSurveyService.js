const pool = require("../db/pool");
const config = require("../config");
const { sendEmail } = require("./email");

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const FINANCE_DEPARTMENTS = new Set(["finance", "finance department"]);
const EXCLUDED_CATEGORIES = new Set(
  String(process.env.FINANCE_IT_SURVEY_EXCLUDED_CATEGORIES || "Duplicate,Auto-Resolved")
    .split(",")
    .map(c => c.trim().toLowerCase())
    .filter(Boolean)
);

async function loadTicket(itTicketId) {
  try {
    return (await pool.query(
      `SELECT t.id,t.status,t.workspace,t.requester_id,t.category,t.created_at,t.resolved_at,t.closed_at,COALESCE(t.closed_at,t.resolved_at) AS resolution_at,u.department AS requester_department
       FROM tickets t LEFT JOIN users u ON u.id=t.requester_id WHERE t.id=$1::bigint`,
      [itTicketId]
    )).rows[0];
  } catch (error) {
    if (error.code === "42703") {
      return (await pool.query(
        `SELECT t.id,t.status,t.workspace,t.requester_id,NULL AS category,t.created_at,t.resolved_at,t.closed_at,COALESCE(t.closed_at,t.resolved_at) AS resolution_at,u.department AS requester_department
         FROM tickets t LEFT JOIN users u ON u.id=t.requester_id WHERE t.id=$1::bigint`,
        [itTicketId]
      )).rows[0];
    }
    throw error;
  }
}

async function requesterIsFinanceEmployee(requesterId) {
  const row = (await pool.query(
    `SELECT u.department,fr.id AS responsibility_id FROM users u
     LEFT JOIN finance_employee_responsibilities fr ON fr.user_id=u.id AND fr.active=TRUE
     WHERE u.id=$1::bigint`,
    [requesterId]
  )).rows[0];
  if (!row) return false;
  return FINANCE_DEPARTMENTS.has(String(row.department || "").trim().toLowerCase()) || Boolean(row.responsibility_id);
}

async function surveyExists(itTicketId) {
  const row = await pool.query(`SELECT 1 FROM finance_it_service_surveys WHERE it_ticket_id=$1::bigint LIMIT 1`, [itTicketId]);
  return Boolean(row.rowCount);
}

async function checkSurveyApplicability({itTicketId, financeUserId}) {
  if (!itTicketId) throw fail(400, "SURVEY_FIELDS_REQUIRED", "An IT ticket ID is required.");
  const ticket = await loadTicket(itTicketId);
  if (!ticket) return {applicable: false, reason: "TICKET_NOT_FOUND"};
  if (!["Resolved", "Closed"].includes(ticket.status)) return {applicable: false, reason: "TICKET_NOT_RESOLVED"};
  if (ticket.workspace !== "IT") return {applicable: false, reason: "TICKET_NOT_IT_WORKSPACE"};
  if (financeUserId != null && String(ticket.requester_id) !== String(financeUserId)) return {applicable: false, reason: "REQUESTER_MISMATCH"};
  if (!(await requesterIsFinanceEmployee(ticket.requester_id))) return {applicable: false, reason: "REQUESTER_NOT_FINANCE"};
  if (await surveyExists(itTicketId)) return {applicable: false, reason: "SURVEY_ALREADY_SUBMITTED"};
  if (EXCLUDED_CATEGORIES.has(String(ticket.category || "").trim().toLowerCase())) return {applicable: false, reason: "CATEGORY_EXCLUDED"};
  const created = new Date(ticket.created_at).getTime();
  const resolved = new Date(ticket.resolution_at).getTime();
  if (!Number.isFinite(resolved) || !Number.isFinite(created) || resolved <= created) return {applicable: false, reason: "RESOLUTION_INSTANT"};
  const expiryDays = config.financeAdvanced?.itSurveyExpiryDays ?? 14;
  if (Date.now() - resolved > expiryDays * 86400000) return {applicable: false, reason: "SURVEY_EXPIRED"};
  return {applicable: true, reason: null, ticket};
}

function classifyNps(npsScore) {
  if (npsScore >= 9) return "Promoter";
  if (npsScore >= 7) return "Passive";
  return "Detractor";
}

async function submitSurvey({itTicketId, financeUserId, satisfactionRating, npsScore, feedbackText, categoryRatings, consentToIdentity}) {
  if (!itTicketId || !financeUserId) throw fail(400, "SURVEY_FIELDS_REQUIRED", "An IT ticket ID and Finance user are required.");
  const satisfaction = Number(satisfactionRating);
  if (!Number.isInteger(satisfaction) || satisfaction < 1 || satisfaction > 5) throw fail(400, "INVALID_SATISFACTION_RATING", "Satisfaction rating must be between 1 and 5.");
  const nps = Number(npsScore);
  if (!Number.isInteger(nps) || nps < 0 || nps > 10) throw fail(400, "INVALID_NPS_SCORE", "NPS score must be between 0 and 10.");
  const ticket = await loadTicket(itTicketId);
  if (!ticket) throw fail(404, "TICKET_NOT_FOUND", "IT ticket not found.");
  if (String(ticket.requester_id) !== String(financeUserId)) throw fail(403, "SURVEY_SUBMITTER_MISMATCH", "Only the ticket requester may submit this survey.");
  if (await surveyExists(itTicketId)) throw fail(409, "SURVEY_ALREADY_SUBMITTED", "A survey has already been submitted for this ticket.");
  const expiryDays = config.financeAdvanced?.itSurveyExpiryDays ?? 14;
  const resolved = new Date(ticket.resolution_at).getTime();
  if (!Number.isFinite(resolved) || Date.now() - resolved > expiryDays * 86400000) {
    throw fail(410, "SURVEY_EXPIRED", `Surveys must be submitted within ${expiryDays} days of resolution.`);
  }
  const classification = classifyNps(nps);
  try {
    const result = await pool.query(
      `INSERT INTO finance_it_service_surveys(it_ticket_id,finance_user_id,satisfaction_rating,nps_score,nps_classification,feedback_text,category_ratings,consent_to_identity)
       VALUES($1::bigint,$2::bigint,$3,$4,$5,$6,$7::jsonb,$8) RETURNING *`,
      [itTicketId, financeUserId, satisfaction, nps, classification, feedbackText ?? null, categoryRatings ? JSON.stringify(categoryRatings) : null, consentToIdentity === true]
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === "23505") throw fail(409, "SURVEY_ALREADY_SUBMITTED", "A survey has already been submitted for this ticket.");
    throw error;
  }
}

async function getSurvey(itTicketId) {
  const result = await pool.query(`SELECT * FROM finance_it_service_surveys WHERE it_ticket_id=$1::bigint`, [itTicketId]);
  if (!result.rowCount) throw fail(404, "SURVEY_NOT_FOUND", "No survey exists for this ticket.");
  return result.rows[0];
}

function stripIdentity(survey) {
  if (survey.consent_to_identity) return {...survey, submittedBy: "identified"};
  const {finance_user_id, ...rest} = survey;
  return {...rest, finance_user_id: null, submittedBy: "anonymous"};
}

async function getSurveyAggregations({periodKey, category, requestingUserContext} = {}) {
  const params = [periodKey ?? null];
  let categoryClause = "";
  if (category != null) {
    params.push(String(category));
    categoryClause = `AND category_ratings->>$${params.length} IS NOT NULL`;
  }
  const rows = (await pool.query(
    `SELECT * FROM finance_it_service_surveys WHERE ($1::text IS NULL OR to_char(submitted_at,'YYYY-MM')=$1) ${categoryClause} ORDER BY submitted_at DESC`,
    params
  )).rows;
  const total = rows.length;
  const promoters = rows.filter(r => r.nps_classification === "Promoter").length;
  const passives = rows.filter(r => r.nps_classification === "Passive").length;
  const detractors = rows.filter(r => r.nps_classification === "Detractor").length;
  const avgSatisfaction = total ? rows.reduce((s, r) => s + Number(r.satisfaction_rating), 0) / total : null;
  const isFinanceManagement = Boolean(requestingUserContext?.isFinanceManagement);
  const responses = rows.map(row => (isFinanceManagement ? {...row, submittedBy: "identified"} : stripIdentity(row)));
  return {
    periodKey: periodKey ?? null,
    totalResponses: total,
    avgSatisfaction: avgSatisfaction != null ? Math.round(avgSatisfaction * 100) / 100 : null,
    npsScore: total ? Math.round(((promoters - detractors) / total) * 100) : null,
    npsBreakdown: {promoters, passives, detractors},
    responses
  };
}

async function getSurveyTrends({fromPeriod, toPeriod} = {}) {
  const rows = (await pool.query(
    `SELECT to_char(submitted_at,'YYYY-MM') AS period_key,
            AVG(satisfaction_rating) AS avg_satisfaction,
            SUM(CASE WHEN nps_classification='Promoter' THEN 1 ELSE 0 END) AS promoters,
            SUM(CASE WHEN nps_classification='Detractor' THEN 1 ELSE 0 END) AS detractors,
            COUNT(*) AS total
     FROM finance_it_service_surveys
     WHERE ($1::text IS NULL OR to_char(submitted_at,'YYYY-MM')>=$1) AND ($2::text IS NULL OR to_char(submitted_at,'YYYY-MM')<=$2)
     GROUP BY 1 ORDER BY 1`,
    [fromPeriod ?? null, toPeriod ?? null]
  )).rows;
  let previous = null;
  return rows.map(row => {
    const total = Number(row.total);
    const avgSatisfaction = Math.round(Number(row.avg_satisfaction) * 100) / 100;
    const npsScore = Math.round(((Number(row.promoters) - Number(row.detractors)) / total) * 100);
    const pctChange = previous != null && previous !== 0 ? Math.round(((avgSatisfaction - previous) / previous) * 1000) / 10 : null;
    const entry = {periodKey: row.period_key, avgSatisfaction, npsScore, totalResponses: total, previousAvgSatisfaction: previous, pctChange};
    previous = avgSatisfaction;
    return entry;
  });
}

async function triggerSurveyOnResolution(itTicketId) {
  const ticket = await loadTicket(itTicketId);
  if (!ticket || ticket.workspace !== "IT") return {triggered: false, reason: "TICKET_NOT_IT_WORKSPACE"};
  const applicability = await checkSurveyApplicability({itTicketId, financeUserId: null});
  if (!applicability.applicable) return {triggered: false, reason: applicability.reason};
  try {
    const requester = (await pool.query(`SELECT email,name FROM users WHERE id=$1::bigint`, [ticket.requester_id])).rows[0];
    if (requester?.email) {
      await sendEmail({
        to: requester.email,
        category: "finance_it_survey",
        subject: "IT service survey: how did we do?",
        text: `Your IT ticket has been resolved.\n\nWe would value your feedback on the service you received. Please complete the short service survey in the Finance workspace.\n\nTicket ID: ${itTicketId}`,
        html: `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.55"><h2>IT service survey</h2><p>Your IT ticket has been resolved. We would value your feedback on the service you received.</p><p>Ticket ID: ${itTicketId}</p></div>`
      });
    }
  } catch (error) {
    console.warn("IT survey invitation failed:", error.message);
  }
  return {triggered: true, ticketId: Number(itTicketId), requesterUserId: Number(ticket.requester_id)};
}

module.exports = {
  checkSurveyApplicability,
  submitSurvey,
  getSurvey,
  getSurveyAggregations,
  getSurveyTrends,
  triggerSurveyOnResolution
};