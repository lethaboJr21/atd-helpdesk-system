//This file contains the authentication routes for the backend. It handles login, logout, and fetching the current user's info. The original code used a PostgreSQL database to store users and bcrypt for password hashing, but it has been temporarily replaced with hardcoded dev users for development purposes. The JWT token is generated upon successful login and includes the user's ID, email, role, and name.
const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");
const auth = require("../middleware/auth");

/**
 * ✅ Create JWT token after successful login
 * The token stores basic user identity and role.
 */
function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    }
  );
}

/**
 * ✅ Helper: Create non-blocking in-app notification
 * If the notifications table has an issue, the main auth flow must not fail.
 */
async function createNotification(message, type = "system") {
  try {
    await pool.query(
      `
      INSERT INTO notifications (message, type, is_read)
      VALUES ($1, $2, false)
      `,
      [message, type]
    );
  } catch (err) {
    console.error("Notification creation failed:", err.message);
  }
}

/**
 * ✅ POST /api/auth/login
 * Logs in approved users only.
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // ✅ Validate request body
  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password required",
    });
  }

  try {
    // ✅ Find user by email
    const { rows } = await pool.query(
      `
      SELECT id, name, email, password_hash, role, approved
      FROM users
      WHERE email = $1
      `,
      [email.toLowerCase()]
    );

    const user = rows[0];

    // ✅ Do not reveal whether email exists
    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    // ✅ Block pending role users
    if (user.role === "pending") {
      return res.status(403).json({
        message: "Your account is pending approval",
      });
    }

    // ✅ Block unapproved users
    // Admin/superadmin exception prevents accidental admin lockout.
    if (!user.approved && !["admin", "superadmin"].includes(user.role)) {
      return res.status(403).json({
        message: "Your account is pending approval",
      });
    }

    // ✅ Validate password
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    // ✅ Generate JWT token
    const token = signToken(user);

    // ✅ Return safe user object
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        approved: user.approved,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      error: "Server error",
    });
  }
});

/**
 * ✅ POST /api/auth/signup
 * Creates a pending account.
 * Does NOT log user in immediately.
 */
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  // ✅ Validate input
  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Name, email and password are required",
    });
  }

  try {
    // ✅ Check duplicate email
    const existing = await pool.query(
      `
      SELECT id
      FROM users
      WHERE email = $1
      `,
      [email.toLowerCase()]
    );

    if (existing.rows[0]) {
      return res.status(409).json({
        error: "User already exists",
      });
    }

    // ✅ Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // ✅ Create user as pending and unapproved
    const { rows } = await pool.query(
      `
      INSERT INTO users (name, email, password_hash, role, approved)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, role, approved, created_at
      `,
      [name.trim(), email.toLowerCase(), passwordHash, "pending", false]
    );

    const newUser = rows[0];

    // ✅ Create in-app notification for admins
    await createNotification(
      `New user signup pending approval: ${newUser.email}`,
      "user_signup"
    );
    //
    console.log("Sending approval email for:", newUser.email);
    console.log("Admin email target:", process.env.ADMIN_EMAIL);
    // ✅ Try sending approval email, but do not break signup if email fails
    try {
      const { sendApprovalEmail } = require("../services/email");

      await sendApprovalEmail({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      });
    } catch (emailErr) {
      console.error(
        "Approval email failed, but signup continues:",
        emailErr.message
      );
    }

    // ✅ Important: do NOT return token here
    return res.status(201).json({
      message:
        "Account created successfully. Please wait for admin approval before signing in.",
      user: newUser,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({
      error: "Server error",
    });
  }
});

/**
 * ✅ POST /api/auth/logout
 * Stateless JWT logout. Frontend removes token.
 */
router.post("/logout", auth, (_req, res) => {
  return res.json({
    ok: true,
  });
});

/**
 * ✅ GET /api/auth/me
 * Returns current authenticated user.
 */
router.get("/me", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT id, name, email, role, approved
      FROM users
      WHERE id = $1
      `,
      [req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    return res.json({
      user: rows[0],
    });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({
      error: "Server error",
    });
  }
});

/**
 * ✅ GET /api/auth/users
 * Admin and superadmin can view all users.
 * Pending users are shown first.
 */
router.get("/users", auth, async (req, res) => {
  // ✅ Only admin and superadmin can view users
  if (!["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({
      error: "Access denied",
    });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT id, name, email, role, approved, created_at
      FROM users
      ORDER BY approved ASC, created_at DESC
      `
    );

    return res.json(rows);
  } catch (err) {
    console.error("Fetch users error:", err);
    return res.status(500).json({
      error: "Failed to fetch users",
    });
  }
});

/**
 * ✅ PUT /api/auth/approve/:id
 * Admin approves a pending user and assigns a role.
 */
router.put("/approve/:id", auth, async (req, res) => {
  const role = req.body.role || req.query.role || "user";

  // ✅ Only admin and superadmin can approve
  if (!["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({
      error: "Access denied",
    });
  }

  // ✅ Allowed roles after approval
  const allowedRoles = [
    "user",
    "agent",
    "operator",
    "manager",
    "admin",
    "superadmin",
  ];

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({
      error: "Invalid role",
    });
  }

  try {
    const { rows } = await pool.query(
      `
      UPDATE users
      SET role = $1,
          approved = TRUE
      WHERE id = $2
      RETURNING id, name, email, role, approved
      `,
      [role, req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // ✅ Create in-app notification
    await createNotification(
      `User approved: ${rows[0].email} as ${rows[0].role}`,
      "user_approved"
    );

    return res.json({
      message: "User approved successfully",
      user: rows[0],
    });
  } catch (err) {
    console.error("Approve error:", err);
    return res.status(500).json({
      error: "Approval failed",
    });
  }
});

/**
 * ✅ DELETE /api/auth/reject/:id
 * Admin rejects and removes a pending user.
 */
router.delete("/reject/:id", auth, async (req, res) => {
  // ✅ Only admin and superadmin can reject users
  if (!["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({
      error: "Access denied",
    });
  }

  try {
    const { rows } = await pool.query(
      `
      DELETE FROM users
      WHERE id = $1
      RETURNING id, email
      `,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // ✅ Create in-app notification
    await createNotification(
      `User rejected and removed: ${rows[0].email}`,
      "user_rejected"
    );

    return res.json({
      message: "User rejected and removed",
      user: rows[0],
    });
  } catch (err) {
    console.error("Reject user error:", err);
    return res.status(500).json({
      error: "Reject failed",
    });
  }
});

/**
 * ✅ Optional backward-compatible reject link
 * This keeps your old GET reject URL working, but protected.
 */
router.get("/reject/:id", auth, async (req, res) => {
  // ✅ Only admin and superadmin can reject users
  if (!["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).send("Access denied");
  }

  try {
    const { rows } = await pool.query(
      `
      DELETE FROM users
      WHERE id = $1
      RETURNING id, email
      `,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).send("User not found");
    }

    await createNotification(
      `User rejected and removed: ${rows[0].email}`,
      "user_rejected"
    );

    return res.send("User rejected and removed");
  } catch (err) {
    console.error("Reject user error:", err);
    return res.status(500).send("Reject failed");
  }
});

module.exports = router;