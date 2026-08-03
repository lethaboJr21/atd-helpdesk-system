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

// GET /api/stats/volume  — bar chart (last 7 days)
router.get('/volume', async (req, res) => {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  try {
    const { rows } = await pool.query(`
      SELECT
        to_char(created_at, 'Dy') AS day,
        SUM(CASE WHEN COALESCE(category, workspace, '') <> 'Change Management' AND title NOT ILIKE '%request%' THEN 1 ELSE 0 END) AS incidents,
        SUM(CASE WHEN title ILIKE '%request%' THEN 1 ELSE 0 END) AS requests,
        SUM(CASE WHEN COALESCE(category, workspace, '') = 'Change Management' THEN 1 ELSE 0 END) AS changes
      FROM tickets
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY to_char(created_at, 'Dy')
      ORDER BY MIN(created_at)
    `)
    // Fallback static if not enough data
    if (rows.length < 2) {
      return res.json([
        { day: 'Mon', incidents: 42, requests: 28, changes: 7 },
        { day: 'Tue', incidents: 51, requests: 32, changes: 9 },
        { day: 'Wed', incidents: 47, requests: 35, changes: 6 },
        { day: 'Thu', incidents: 62, requests: 29, changes: 11 },
        { day: 'Fri', incidents: 55, requests: 38, changes: 8 },
        { day: 'Sat', incidents: 24, requests: 12, changes: 4 },
        { day: 'Sun', incidents: 19, requests: 8,  changes: 2 },
      ])
    }
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
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
