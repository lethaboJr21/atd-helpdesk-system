const express = require("express");
const router = express.Router();

const { getUsers } = require("../services/azureUsers");
const pool = require("../db/pool");

// ✅ GET users
router.get("/users", async (req, res) => {
  try {
    const users = await getUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post("/sync", async (req, res) => {
  try {
    const users = await getUsers();
    await syncAzureUsers(users);

    res.json({ message: "Azure users synced successfully" });
  } catch (err) {
    console.error("SYNC ERROR:", err);
    res.status(500).json({ error: "Sync failed" });
  }
});

// ✅ SYNC users
async function syncAzureUsers(users) {
  for (const user of users) {
    const email = (user.mail || user.userPrincipalName || "").toLowerCase();

    if (!email || !user.displayName || !email.includes("@atdalliance.co.za")) continue;

    try {
      await pool.query(
        `
        INSERT INTO users (name, email, role)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        `,
        [user.displayName, email, "user"]
      );
    } catch (err) {
      console.error("User sync error:", err.message);
    }
  }
}
;

module.exports = router;