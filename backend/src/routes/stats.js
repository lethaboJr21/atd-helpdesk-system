const router = require('express').Router()
const pool = require('../db/pool')
const auth = require('../middleware/auth')

router.use(auth)

// GET /api/stats/dashboard  — KPI cards (full ticket table, not a page sample)
router.get('/dashboard', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status NOT IN ('Resolved','Closed'))::int AS open_tickets,
        COUNT(*) FILTER (
          WHERE status NOT IN ('Resolved','Closed')
            AND (priority = 'Critical' OR (due_at IS NOT NULL AND due_at < NOW()))
        )::int AS critical_at_risk,
        COUNT(*) FILTER (WHERE due_at IS NOT NULL)::int AS with_due,
        COUNT(*) FILTER (
          WHERE due_at IS NOT NULL
            AND COALESCE(closed_at, NOW()) <= due_at
        )::int AS within_sla,
        ROUND(
          AVG(EXTRACT(EPOCH FROM (closed_at - created_at)))
          FILTER (WHERE closed_at IS NOT NULL AND status IN ('Resolved','Closed'))
        )::bigint AS avg_close_secs
      FROM tickets
    `)

    const row = rows[0]
    const withDue = row.with_due || 0
    const withinSla = row.within_sla || 0
    const avgSecs = Number(row.avg_close_secs) || 0
    let averageResolution = 'N/A'
    if (avgSecs > 0) {
      const days = Math.floor(avgSecs / 86400)
      const hours = Math.floor((avgSecs % 86400) / 3600)
      const minutes = Math.floor((avgSecs % 3600) / 60)
      if (days > 0) averageResolution = hours > 0 ? `${days}d ${hours}h` : `${days}d`
      else if (hours > 0) averageResolution = `${hours}h ${minutes}m`
      else averageResolution = `${minutes}m`
    }

    res.json({
      open: row.open_tickets,
      total: row.total,
      critical: row.critical_at_risk,
      slaCompliance: withDue ? `${Math.round((withinSla / withDue) * 100)}%` : 'N/A',
      averageResolution,
      // legacy keys kept for older clients
      open_incidents: row.open_tickets,
      pending_requests: row.open_tickets,
      sla_compliance: withDue ? Math.round((withinSla / withDue) * 100) : 0,
      avg_resolution: averageResolution,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/stats/volume  — bar chart by created date (full table)
router.get('/volume', async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90)
  try {
    const { rows } = await pool.query(
      `
      WITH days AS (
        SELECT generate_series(
          (CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day')::date,
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS day
      ),
      counted AS (
        SELECT
          (created_at AT TIME ZONE 'Africa/Johannesburg')::date AS day,
          COUNT(*) FILTER (WHERE UPPER(COALESCE(ticket_ref, '')) LIKE 'REQ%')::int AS requests,
          COUNT(*) FILTER (WHERE UPPER(COALESCE(ticket_ref, '')) LIKE 'CHG%')::int AS changes,
          COUNT(*) FILTER (
            WHERE UPPER(COALESCE(ticket_ref, '')) NOT LIKE 'REQ%'
              AND UPPER(COALESCE(ticket_ref, '')) NOT LIKE 'CHG%'
          )::int AS incidents
        FROM tickets
        WHERE created_at >= (CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day')
        GROUP BY 1
      )
      SELECT
        to_char(days.day, 'Dy') AS day,
        COALESCE(counted.incidents, 0) AS incidents,
        COALESCE(counted.requests, 0) AS requests,
        COALESCE(counted.changes, 0) AS changes
      FROM days
      LEFT JOIN counted ON counted.day = days.day
      ORDER BY days.day
      `,
      [days]
    )
    return res.json(rows)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/stats/service-mix — open workload by support group / workspace
router.get('/service-mix', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(g.name, t.external_group_name, NULLIF(t.workspace, ''), 'Unassigned / Other') AS name,
        COUNT(*)::int AS value
      FROM tickets t
      LEFT JOIN support_groups g ON g.id = t.assigned_group_id
      WHERE t.status NOT IN ('Resolved', 'Closed')
      GROUP BY 1
      ORDER BY value DESC, name ASC
    `)
    const colors = ['#2563eb', '#7c3aed', '#16a34a', '#f97316', '#0891b2', '#db2777', '#0f766e']
    return res.json(
      rows.map((row, index) => ({
        name: row.name,
        value: row.value,
        color: colors[index % colors.length],
      }))
    )
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/stats/sla-trend
router.get('/sla-trend', async (_req, res) => {
  // Hourly SLA average for today
  try {
    const { rows } = await pool.query(`
      SELECT
        to_char(created_at, 'HH24:00') AS hour,
        ROUND(AVG(sla_pct)) AS score
      FROM tickets
      WHERE created_at >= CURRENT_DATE
      GROUP BY to_char(created_at, 'HH24:00')
      ORDER BY 1
    `)
    if (rows.length < 2) {
      return res.json([
        { hour: '06:00', score: 88 }, { hour: '08:00', score: 84 },
        { hour: '10:00', score: 81 }, { hour: '12:00', score: 79 },
        { hour: '14:00', score: 86 }, { hour: '16:00', score: 91 },
      ])
    }
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/stats/categories
router.get('/categories', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT COALESCE(category, workspace) AS name, COUNT(*) AS cnt
      FROM tickets
      WHERE status NOT IN ('Closed','Resolved')
        AND COALESCE(category, workspace) IS NOT NULL
      GROUP BY COALESCE(category, workspace)
      ORDER BY cnt DESC
      LIMIT 8
    `)
    const total = rows.reduce((s, r) => s + parseInt(r.cnt), 0) || 1
    const colors = { Infrastructure: '#2563eb', 'Application Development': '#7c3aed', 'Change Management': '#f97316', 'Access / Security': '#16a34a' }
    const data = rows.map(r => ({
      name: r.name,
      value: Math.round(parseInt(r.cnt) / total * 100),
      color: colors[r.name] || '#94a3b8',
    }))
    res.json(data.length ? data : [
      { name: 'Infrastructure', value: 48, color: '#2563eb' },
      { name: 'Applications',   value: 34, color: '#7c3aed' },
      { name: 'Access',         value: 12, color: '#16a34a' },
      { name: 'Change',         value: 6,  color: '#f97316' },
    ])
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/stats/assets
router.get('/assets', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT name, icon, status, score FROM asset_health ORDER BY name')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
