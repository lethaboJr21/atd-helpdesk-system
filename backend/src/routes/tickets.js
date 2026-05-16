
const router = require("express").Router();
const jwt = require("jsonwebtoken");

// Temporary dev user (no DB yet)
const DEV_USER = {
  id: 1,
  name: "Jeffrey Motepe",
  email: "JeffreyM@atdalliance.co.za",
  role: "admin",
  password: "123456",
};

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token is invalid or expired" });
  }
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  if (
    email.toLowerCase() !== DEV_USER.email.toLowerCase() ||
    password !== DEV_USER.password
  ) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = createToken(DEV_USER);

  return res.json({
    token,
    user: {
      id: DEV_USER.id,
      name: DEV_USER.name,
      email: DEV_USER.email,
      role: DEV_USER.role,
    },
  });
});

// POST /api/auth/logout
router.post("/logout", auth, (_req, res) => {
  res.json({ ok: true });
});

// GET /api/auth/me
router.get("/me", auth, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

module.exports = router;

/*const router = require('express').Router()
const pool = require('../db/pool')
const auth = require('../middleware/auth')

// All ticket routes require auth
router.use(auth)

// Helper: format age string from created_at
function formatAge(createdAt) {
  const diffMs = Date.now() - new Date(createdAt).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m`
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`
}

// GET /api/tickets
router.get('/', async (req, res) => {
  const { category, search, status, priority, limit = 50, offset = 0 } = req.query

  let where = []
  let params = []
  let i = 1

  if (category) { where.push(`category = $${i++}`); params.push(category) }
  if (status)   { where.push(`status = $${i++}`);   params.push(status) }
  if (priority) { where.push(`priority = $${i++}`); params.push(priority) }
  if (search) {
    where.push(`(ticket_ref ILIKE $${i} OR title ILIKE $${i} OR requester ILIKE $${i} OR owner ILIKE $${i} OR site ILIKE $${i})`)
    params.push(`%${search}%`); i++
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  try {
    const { rows } = await pool.query(
      `SELECT * FROM tickets ${whereClause}
       ORDER BY
         CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
         created_at DESC
       LIMIT $${i} OFFSET $${i+1}`,
      [...params, limit, offset]
    )
    res.json(rows.map(t => ({ ...t, age: formatAge(t.created_at) })))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/tickets/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Ticket not found' })
    res.json({ ...rows[0], age: formatAge(rows[0].created_at) })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/tickets  — create
router.post('/', async (req, res) => {
  const { title, requester, category, service, priority, site, owner } = req.body
  if (!title || !requester || !category) {
    return res.status(400).json({ error: 'title, requester and category are required' })
  }

  // Generate a ticket reference
  const prefix = category === 'Change Management' ? 'CHG' : title.toLowerCase().includes('request') ? 'REQ' : 'INC'
  const { rows: [{ nextval }] } = await pool.query("SELECT nextval('tickets_id_seq')")
  const ref = `${prefix}-${String(nextval).padStart(5, '0')}`

  try {
    const { rows } = await pool.query(
      `INSERT INTO tickets (id, ticket_ref, title, requester, category, service, priority, site, owner, status, sla_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Open',100) RETURNING *`,
      [nextval, ref, title, requester, category, service || '', priority || 'Medium', site || 'HQ', owner || 'Unassigned']
    )
    res.status(201).json({ ...rows[0], age: '0m' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/tickets/:id  — full update
router.put('/:id', async (req, res) => {
  const { title, requester, category, service, priority, status, site, owner, sla_pct } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE tickets SET
         title=$1, requester=$2, category=$3, service=$4, priority=$5,
         status=$6, site=$7, owner=$8, sla_pct=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [title, requester, category, service, priority, status, site, owner, sla_pct, req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Ticket not found' })
    res.json({ ...rows[0], age: formatAge(rows[0].created_at) })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/tickets/:id/close
router.patch('/:id/close', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE tickets SET status='Closed', closed_at=NOW(), updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Ticket not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
*/
