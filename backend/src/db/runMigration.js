require("dotenv").config();

const fs = require("fs");
const path = require("path");
const pool = require("./pool");

async function runMigration() {
  const migrationName = process.argv[2];

  if (!migrationName) {
    console.error(
      "Migration filename required. Example: node src/db/runMigration.js 2026-07-user-profile.sql"
    );
    process.exitCode = 1;
    return;
  }

  const migrationPath = path.join(
    __dirname,
    "migrations",
    migrationName
  );

  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration not found: ${migrationPath}`);
    process.exitCode = 1;
    return;
  }

  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    console.log(`Running migration: ${migrationName}`);

    await pool.query(sql);

    console.log(`Migration completed: ${migrationName}`);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();