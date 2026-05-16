const router = require('express').Router()
const pool = require('../db/pool')
const auth = require('../middleware/auth')

router.use(auth)

// GET /api/stats/dashboard  — KPI cards
router.get('/dashboard', async (req, res) => {
  try {
    const [openRes, pendingRes, slaRes, avgRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM tickets WHERE status NOT IN ('Closed','Resolved') AND category != 'Change Management'`),
      pool.query(`SELECT COUNT(*) FROM tickets WHERE status IN ('Open','Assigned','Waiting Approval')`),
      pool.query(`SELECT ROUND(AVG(sla_pct)) AS sla FROM tickets WHERE created_at > NOW() - INTERVAL '7 days'`),
      pool.query(`SELECT ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(closed_at, NOW()) - created_at))/60)) AS mins FROM tickets WHERE created_at > NOW() - INTERVAL '7 days'`),
    ])

    const avgMins = parseInt(avgRes.rows[0].mins) || 0
    const avgFmt = avgMins >= 60 ? `${Math.floor(avgMins/60)}h ${avgMins%60}m` : `${avgMins}m`

    res.json({
      open_incidents:    parseInt(openRes.rows[0].count),
      pending_requests:  parseInt(pendingRes.rows[0].count),
      sla_compliance:    parseInt(slaRes.rows[0].sla) || 0,
      avg_resolution:    avgFmt,
      incidents_delta:   '+3',
      requests_delta:    '-2',
      sla_delta:         '+1.2%',
      resolution_delta:  '12m',
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
        SUM(CASE WHEN category != 'Change Management' AND title NOT ILIKE '%request%' THEN 1 ELSE 0 END) AS incidents,
        SUM(CASE WHEN title ILIKE '%request%' THEN 1 ELSE 0 END) AS requests,
        SUM(CASE WHEN category = 'Change Management' THEN 1 ELSE 0 END) AS changes
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
      SELECT category AS name, COUNT(*) AS cnt
      FROM tickets WHERE status NOT IN ('Closed','Resolved')
      GROUP BY category
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
