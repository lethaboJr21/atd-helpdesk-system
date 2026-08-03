const express = require("express");
const fs = require("fs");
const path = require("path");

const pool = require("../db/pool");
const auth = require("../middleware/auth");

const ATTACHMENT_ROOT = path.resolve(
  process.env.FRESHSERVICE_ATTACHMENT_DIR ||
    path.join(__dirname, "..", "..", "storage", "freshservice-attachments")
);

const router = express.Router();

router.use(auth);

const OPERATIONS_ROLES = new Set([
  "agent",
  "operator",
  "manager",
  "admin",
  "superadmin",
]);

function isOperational(request) {
  return OPERATIONS_ROLES.has(String(request.user?.role || "").toLowerCase());
}

function requireOperational(request, response, next) {
  if (!isOperational(request)) {
    return response.status(403).json({
      code: "ROLE_ACCESS_DENIED",
      error: "Archive search is limited to helpdesk staff",
    });
  }
  return next();
}

function parsePage(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePerPage(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 25;
  return Math.min(parsed, 200);
}

const SORT_COLUMNS = {
  created_at: "t.created_at",
  updated_at: "t.updated_at",
  closed_at: "t.closed_at",
  priority: "t.priority_id",
  status: "t.status_label",
  reference: "t.fs_id",
};

/**
 * Aggregate view of what has been mirrored out of Freshservice, plus the state
 * of the most recent sync run.
 */
router.get("/summary", requireOperational, async (request, response) => {
  try {
    const [totals, spread, statusBreakdown, typeBreakdown, lastRun] =
      await Promise.all([
        pool.query(`
          SELECT
            (SELECT COUNT(*) FROM fs_tickets)                                  AS tickets,
            (SELECT COUNT(*) FROM fs_tickets WHERE detail_synced_at IS NOT NULL) AS tickets_detailed,
            (SELECT COUNT(*) FROM fs_ticket_conversations)                     AS conversations,
            (SELECT COUNT(*) FROM fs_attachments)                             AS attachments,
            (SELECT COUNT(*) FROM fs_people WHERE kind = 'requester')          AS requesters,
            (SELECT COUNT(*) FROM fs_people WHERE kind = 'agent')              AS agents,
            (SELECT COUNT(*) FROM fs_assets)                                   AS assets,
            (SELECT COUNT(*) FROM fs_records WHERE kind = 'solution_article')   AS knowledge_articles,
            (SELECT COUNT(*) FROM fs_records)                                  AS reference_records
        `),
        pool.query(`
          SELECT MIN(created_at) AS oldest, MAX(created_at) AS newest
            FROM fs_tickets
        `),
        pool.query(`
          SELECT COALESCE(status_label, 'Unknown') AS label, COUNT(*)::int AS total
            FROM fs_tickets
           GROUP BY 1
           ORDER BY total DESC
        `),
        pool.query(`
          SELECT COALESCE(ticket_type, 'Unspecified') AS label, COUNT(*)::int AS total
            FROM fs_tickets
           GROUP BY 1
           ORDER BY total DESC
        `),
        pool.query(`
          SELECT id, mode, status, started_at, finished_at, api_calls, entities, error
            FROM fs_sync_runs
           ORDER BY id DESC
           LIMIT 1
        `),
      ]);

    return response.json({
      totals: totals.rows[0],
      coverage: spread.rows[0],
      byStatus: statusBreakdown.rows,
      byType: typeBreakdown.rows,
      lastSync: lastRun.rows[0] || null,
    });
  } catch (error) {
    console.error("Archive summary failed:", error.message);
    return response.status(500).json({ error: "Unable to load archive summary" });
  }
});

/** Distinct values for the search filters. */
router.get("/filters", requireOperational, async (request, response) => {
  try {
    const [statuses, priorities, types, categories, groups, agents] =
      await Promise.all([
        pool.query(
          "SELECT DISTINCT status_label AS value FROM fs_tickets WHERE status_label IS NOT NULL ORDER BY 1"
        ),
        pool.query(
          "SELECT DISTINCT priority_label AS value FROM fs_tickets WHERE priority_label IS NOT NULL ORDER BY 1"
        ),
        pool.query(
          "SELECT DISTINCT ticket_type AS value FROM fs_tickets WHERE ticket_type IS NOT NULL ORDER BY 1"
        ),
        pool.query(
          "SELECT DISTINCT category AS value FROM fs_tickets WHERE category IS NOT NULL ORDER BY 1"
        ),
        pool.query(
          "SELECT fs_id AS id, name FROM fs_records WHERE kind = 'group' ORDER BY name"
        ),
        pool.query(
          "SELECT fs_id AS id, name FROM fs_people WHERE kind = 'agent' ORDER BY name"
        ),
      ]);

    return response.json({
      statuses: statuses.rows.map((r) => r.value),
      priorities: priorities.rows.map((r) => r.value),
      types: types.rows.map((r) => r.value),
      categories: categories.rows.map((r) => r.value),
      groups: groups.rows,
      agents: agents.rows,
    });
  } catch (error) {
    console.error("Archive filters failed:", error.message);
    return response.status(500).json({ error: "Unable to load archive filters" });
  }
});

/**
 * Builds the shared WHERE clause for archive ticket searches.
 * `restrictToEmail` scopes results to a single requester for employee lookups.
 */
function buildTicketFilters(query, restrictToEmail = null) {
  const clauses = [];
  const values = [];

  const add = (sql, value) => {
    values.push(value);
    clauses.push(sql.replace("$$", `$${values.length}`));
  };

  if (restrictToEmail) {
    add("lower(t.requester_email) = lower($$)", restrictToEmail);
  }

  const search = String(query.q || "").trim();
  if (search) {
    values.push(search);
    const index = values.length;
    clauses.push(`(
      to_tsvector('english',
        coalesce(t.subject, '') || ' ' ||
        coalesce(t.description_text, '') || ' ' ||
        coalesce(t.requester_name, '') || ' ' ||
        coalesce(t.requester_email, '')
      ) @@ websearch_to_tsquery('english', $${index})
      OR t.subject ILIKE '%' || $${index} || '%'
      OR t.requester_email ILIKE '%' || $${index} || '%'
      OR t.fs_id::TEXT = regexp_replace($${index}, '\\D', '', 'g')
      OR EXISTS (
        SELECT 1 FROM fs_ticket_conversations c
         WHERE c.ticket_fs_id = t.fs_id
           AND to_tsvector('english', coalesce(c.body_text, ''))
               @@ websearch_to_tsquery('english', $${index})
      )
    )`);
  }

  if (query.status) add("t.status_label = $$", String(query.status));
  if (query.priority) add("t.priority_label = $$", String(query.priority));
  if (query.type) add("t.ticket_type = $$", String(query.type));
  if (query.category) add("t.category = $$", String(query.category));
  if (query.group_id) add("t.group_fs_id = $$", Number(query.group_id));
  if (query.agent_id) add("t.responder_fs_id = $$", Number(query.agent_id));
  if (query.requester_email)
    add("lower(t.requester_email) = lower($$)", String(query.requester_email));
  if (query.from) add("t.created_at >= $$", String(query.from));
  if (query.to) add("t.created_at <= $$", String(query.to));

  if (query.include_spam !== "true") clauses.push("COALESCE(t.spam, FALSE) = FALSE");
  if (query.include_deleted !== "true")
    clauses.push("COALESCE(t.deleted, FALSE) = FALSE");

  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

async function searchTickets(query, restrictToEmail = null) {
  const { where, values } = buildTicketFilters(query, restrictToEmail);

  const page = parsePage(query.page);
  const perPage = parsePerPage(query.per_page);
  const offset = (page - 1) * perPage;

  const sortColumn = SORT_COLUMNS[String(query.sort || "created_at")] || SORT_COLUMNS.created_at;
  const direction = String(query.direction || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM fs_tickets t ${where}`,
    values
  );

  const rows = await pool.query(
    `SELECT
       t.fs_id,
       'FS-' || t.fs_id           AS reference,
       t.subject,
       t.ticket_type,
       t.status_label,
       t.priority_label,
       t.source_label,
       t.category,
       t.sub_category,
       t.requester_name,
       t.requester_email,
       t.responder_name,
       COALESCE(t.group_name, g.name)      AS group_name,
       COALESCE(t.department_name, d.name) AS department_name,
       a.name                     AS assigned_agent_name,
       t.created_at,
       t.updated_at,
       t.resolved_at,
       t.closed_at,
       t.due_by,
       t.is_escalated,
       t.spam,
       t.deleted,
       t.conversation_count,
       t.local_ticket_id
     FROM fs_tickets t
     LEFT JOIN fs_records g ON g.kind = 'group'      AND g.fs_id = t.group_fs_id
     LEFT JOIN fs_records d ON d.kind = 'department' AND d.fs_id = t.department_fs_id
     LEFT JOIN fs_people  a ON a.fs_id = t.responder_fs_id
     ${where}
     ORDER BY ${sortColumn} ${direction} NULLS LAST, t.fs_id DESC
     LIMIT ${perPage} OFFSET ${offset}`,
    values
  );

  return {
    tickets: rows.rows,
    pagination: {
      page,
      perPage,
      total: countResult.rows[0].total,
      totalPages: Math.max(1, Math.ceil(countResult.rows[0].total / perPage)),
    },
  };
}

router.get("/tickets", requireOperational, async (request, response) => {
  try {
    return response.json(await searchTickets(request.query));
  } catch (error) {
    console.error("Archive ticket search failed:", error.message);
    return response.status(500).json({ error: "Unable to search the archive" });
  }
});

/** Employees can always trace their own Freshservice history. */
router.get("/my-tickets", async (request, response) => {
  try {
    const email = String(request.user?.email || "").trim();
    if (!email) return response.json({ tickets: [], pagination: null });

    return response.json(await searchTickets(request.query, email));
  } catch (error) {
    console.error("Archive personal history failed:", error.message);
    return response.status(500).json({ error: "Unable to load your ticket history" });
  }
});

router.get("/tickets/:fsId", async (request, response) => {
  const fsId = Number.parseInt(request.params.fsId, 10);

  if (!Number.isFinite(fsId)) {
    return response.status(400).json({ error: "Invalid archive ticket id" });
  }

  try {
    const ticketResult = await pool.query(
      `SELECT
         t.*,
         'FS-' || t.fs_id            AS reference,
         COALESCE(t.group_name, g.name)      AS resolved_group_name,
         COALESCE(t.department_name, d.name) AS resolved_department_name,
         a.name                      AS assigned_agent_name,
         a.email                     AS assigned_agent_email,
         r.name                      AS resolved_requester_name,
         r.email                     AS resolved_requester_email,
         r.job_title                 AS requester_job_title
       FROM fs_tickets t
       LEFT JOIN fs_records g ON g.kind = 'group'      AND g.fs_id = t.group_fs_id
       LEFT JOIN fs_records d ON d.kind = 'department' AND d.fs_id = t.department_fs_id
       LEFT JOIN fs_people  a ON a.fs_id = t.responder_fs_id
       LEFT JOIN fs_people  r ON r.fs_id = t.requester_fs_id
       WHERE t.fs_id = $1`,
      [fsId]
    );

    const ticket = ticketResult.rows[0];
    if (!ticket) {
      return response.status(404).json({ error: "Archived ticket not found" });
    }

    const requesterEmail = String(
      ticket.requester_email || ticket.resolved_requester_email || ""
    ).toLowerCase();

    if (
      !isOperational(request) &&
      requesterEmail !== String(request.user.email || "").toLowerCase()
    ) {
      return response.status(403).json({
        code: "ROLE_ACCESS_DENIED",
        error: "You can only view your own archived tickets",
      });
    }

    const [conversations, attachments, tasks, timeEntries] = await Promise.all([
      pool.query(
        `SELECT c.fs_id, c.user_fs_id, c.body_html, c.body_text, c.incoming,
                c.private, c.from_email, c.to_emails, c.cc_emails, c.created_at,
                p.name AS author_name, p.email AS author_email, p.kind AS author_kind
           FROM fs_ticket_conversations c
           LEFT JOIN fs_people p ON p.fs_id = c.user_fs_id
          WHERE c.ticket_fs_id = $1
          ORDER BY c.created_at ASC, c.fs_id ASC`,
        [fsId]
      ),
      pool.query(
        `SELECT fs_id, conversation_fs_id, name, content_type, size_bytes,
                attachment_url, stored_path, created_at
           FROM fs_attachments
          WHERE ticket_fs_id = $1
          ORDER BY created_at ASC NULLS LAST, fs_id ASC`,
        [fsId]
      ),
      pool.query(
        `SELECT fs_id, title, description, status, due_date, closed_at, created_at
           FROM fs_ticket_tasks
          WHERE ticket_fs_id = $1
          ORDER BY created_at ASC`,
        [fsId]
      ),
      pool.query(
        `SELECT fs_id, agent_fs_id, time_spent, billable, note, executed_at
           FROM fs_ticket_time_entries
          WHERE ticket_fs_id = $1
          ORDER BY executed_at ASC NULLS LAST`,
        [fsId]
      ),
    ]);

    return response.json({
      ticket,
      conversations: conversations.rows,
      attachments: attachments.rows,
      tasks: tasks.rows,
      timeEntries: timeEntries.rows,
    });
  } catch (error) {
    console.error("Archive ticket detail failed:", error.message);
    return response.status(500).json({ error: "Unable to load archived ticket" });
  }
});

/**
 * Streams an attachment that was copied out of Freshservice. Employees may only
 * download files from their own tickets.
 */
router.get("/attachments/:fsId/download", async (request, response) => {
  const fsId = Number.parseInt(request.params.fsId, 10);

  if (!Number.isFinite(fsId)) {
    return response.status(400).json({ error: "Invalid attachment id" });
  }

  try {
    const result = await pool.query(
      `SELECT a.name, a.content_type, a.stored_path, t.requester_email
         FROM fs_attachments a
         LEFT JOIN fs_tickets t ON t.fs_id = a.ticket_fs_id
        WHERE a.fs_id = $1`,
      [fsId]
    );

    const attachment = result.rows[0];

    if (!attachment || !attachment.stored_path) {
      return response.status(404).json({
        error: "This attachment was not copied out of Freshservice",
      });
    }

    if (
      !isOperational(request) &&
      String(attachment.requester_email || "").toLowerCase() !==
        String(request.user.email || "").toLowerCase()
    ) {
      return response.status(403).json({
        code: "ROLE_ACCESS_DENIED",
        error: "You can only download attachments from your own tickets",
      });
    }

    // Guard against a stored path escaping the archive directory.
    const absolutePath = path.resolve(ATTACHMENT_ROOT, attachment.stored_path);
    if (!absolutePath.startsWith(`${ATTACHMENT_ROOT}${path.sep}`)) {
      return response.status(400).json({ error: "Invalid attachment path" });
    }

    if (!fs.existsSync(absolutePath)) {
      return response.status(404).json({ error: "Attachment file is missing" });
    }

    response.setHeader(
      "Content-Type",
      attachment.content_type || "application/octet-stream"
    );
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${String(attachment.name || "attachment").replace(/"/g, "")}"`
    );

    return fs.createReadStream(absolutePath).pipe(response);
  } catch (error) {
    console.error("Archive attachment download failed:", error.message);
    return response.status(500).json({ error: "Unable to download attachment" });
  }
});

/** Archived knowledge base articles carried over from Freshservice. */
router.get("/knowledge", requireOperational, async (request, response) => {
  try {
    const search = String(request.query.q || "").trim();
    const values = [];
    let where = "WHERE a.kind = 'solution_article'";

    if (search) {
      values.push(`%${search}%`);
      where += ` AND (a.name ILIKE $1 OR a.raw->>'description_text' ILIKE $1)`;
    }

    const rows = await pool.query(
      `SELECT a.fs_id, a.name AS title, a.updated_at,
              a.raw->>'description'      AS body_html,
              a.raw->>'description_text' AS body_text,
              f.name AS folder_name,
              c.name AS category_name
         FROM fs_records a
         LEFT JOIN fs_records f ON f.kind = 'solution_folder'   AND f.fs_id = a.parent_fs_id
         LEFT JOIN fs_records c ON c.kind = 'solution_category' AND c.fs_id = f.parent_fs_id
         ${where}
         ORDER BY c.name NULLS LAST, f.name NULLS LAST, a.name
         LIMIT 200`,
      values
    );

    return response.json({ articles: rows.rows });
  } catch (error) {
    console.error("Archive knowledge lookup failed:", error.message);
    return response.status(500).json({ error: "Unable to load archived knowledge base" });
  }
});

/** Archived Freshservice CMDB records. */
router.get("/assets", requireOperational, async (request, response) => {
  try {
    const search = String(request.query.q || "").trim();
    const page = parsePage(request.query.page);
    const perPage = parsePerPage(request.query.per_page);
    const offset = (page - 1) * perPage;

    const values = [];
    let where = "";

    if (search) {
      values.push(`%${search}%`);
      where = `WHERE (a.name ILIKE $1 OR a.asset_tag ILIKE $1 OR a.serial_number ILIKE $1)`;
    }

    const [count, rows] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM fs_assets a ${where}`, values),
      pool.query(
        `SELECT a.fs_id, a.display_id, a.name, a.asset_tag, a.serial_number,
                a.impact, a.usage_type, a.created_at, a.updated_at,
                t.name AS asset_type_name,
                u.name AS assigned_to_name,
                u.email AS assigned_to_email,
                l.name AS location_name,
                d.name AS department_name
           FROM fs_assets a
           LEFT JOIN fs_records t ON t.kind = 'asset_type'  AND t.fs_id = a.asset_type_fs_id
           LEFT JOIN fs_people  u ON u.fs_id = a.user_fs_id
           LEFT JOIN fs_records l ON l.kind = 'location'    AND l.fs_id = a.location_fs_id
           LEFT JOIN fs_records d ON d.kind = 'department'  AND d.fs_id = a.department_fs_id
           ${where}
           ORDER BY a.name NULLS LAST
           LIMIT ${perPage} OFFSET ${offset}`,
        values
      ),
    ]);

    return response.json({
      assets: rows.rows,
      pagination: {
        page,
        perPage,
        total: count.rows[0].total,
        totalPages: Math.max(1, Math.ceil(count.rows[0].total / perPage)),
      },
    });
  } catch (error) {
    console.error("Archive asset lookup failed:", error.message);
    return response.status(500).json({ error: "Unable to load archived assets" });
  }
});

/** Sync history so admins can confirm the mirror is still current. */
router.get("/sync-runs", requireOperational, async (request, response) => {
  try {
    const rows = await pool.query(
      `SELECT id, mode, status, started_at, finished_at, api_calls, entities, error
         FROM fs_sync_runs
        ORDER BY id DESC
        LIMIT 25`
    );
    return response.json({ runs: rows.rows });
  } catch (error) {
    console.error("Archive sync history failed:", error.message);
    return response.status(500).json({ error: "Unable to load sync history" });
  }
});

module.exports = router;
