//This file contains the authentication routes for the backend. It handles login, logout, and fetching the current user's info. The original code used a PostgreSQL database to store users and bcrypt for password hashing, but it has been temporarily replaced with hardcoded dev users for development purposes. The JWT token is generated upon successful login and includes the user's ID, email, role, and name.

const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");
const auth = require("../middleware/auth");

function signToken(user) {
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

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    
    //  BLOCK pending users
    if (user.role === "pending") {
      return res.status(403).json({
        error: "Your account is awaiting approval. Please contact admin."
      });
    }


    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Name, email and password are required",
    });
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (existing.rows[0]) {
      return res.status(409).json({ error: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role
      `,
      [name.trim(), email.toLowerCase(), passwordHash, "pending"]
    );

    const user = rows[0];
    const { sendApprovalEmail } = require("../services/email");

    await sendApprovalEmail({
     id: user.id,
     email: user.email,
     name: user.name,
    });

    const token = signToken(user);

    return res.status(201).json({
      token,
      user,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/logout
router.post("/logout", auth, (_req, res) => {
  return res.json({ ok: true });
});

// GET /api/auth/me
router.get("/me", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, role FROM users WHERE id = $1",
      [req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      user: rows[0],
    });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ✅ PUT /api/auth/approve/:id

router.put("/approve/:id", auth, async (req, res) => {
  const role = req.body.role || req.query.role;

  if (!["superadmin", "admin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied" });
  }

  const allowedRoles = ["operator", "manager", "admin", "superadmin"];

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role`,
      [role, req.params.id]
    );

    res.json({
      message: "User approved",
      user: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Approval failed" });
  }
});

// ✅ GET /api/auth/reject/:id
router.get("/reject/:id", async (req, res) => {
  await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
  res.send("User rejected and removed");
});


module.exports = router;


/*

const router = require("express").Router();
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");

// Temporary in-memory dev users (no DB yet)
const DEV_USERS = [
  {
    id: 1,
    name: "Jeffrey Motepe",
    email: "JeffreyM@atdalliance.co.za",
    role: "admin",
    password: "12345",
  },
  {
    id: 2,
    name: "Samkelo Mthembu",
    email: "SamkeloM@atdalliance.co.za",
    role: "admin",
    password: "12345",
  },
  {
    id: 3,
    name: "Clinton Nkwana",
    email: "ClintonN@atdalliance.co.za",
    role: "admin",
    password: "12345",
  },
  {
    id: 4,
    name: "Resego Ngwenya",
    email: "ResegoN@atdalliance.co.za",
    role: "admin",
    password: "12345",
  },
  {
    id: 5,
    name: "Kamogelo Masuluke",
    email: "KamogeloM@atdalliance.co.za",
    role: "admin",
    password: "12345",
  },
];

function signToken(user) {
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

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const user = DEV_USERS.find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase() &&
      u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken(user);

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// POST /api/auth/signup
// TEMPORARY: in-memory only (will reset when backend restarts)
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }

  const existingUser = DEV_USERS.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    return res.status(409).json({ error: "User already exists" });
  }

  const newUser = {
    id: DEV_USERS.length + 1,
    name: name.trim(),
    email: email.trim(),
    role: "pending",
    password,
  };

  DEV_USERS.push(newUser);

  const token = signToken(newUser);

  return res.status(201).json({
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
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

*/