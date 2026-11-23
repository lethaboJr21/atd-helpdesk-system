require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pool = require("./pool");

function parseArgs(argv) {
  const args = { migrationName: null, phase: null, validateOnly: false, rollback: null };
  const positional = [];

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--phase") {
      args.phase = parseInt(argv[++i], 10);
    } else if (arg === "--validate-only") {
      args.validateOnly = true;
    } else if (arg === "--rollback") {
      args.rollback = argv[++i];
    } else {
      positional.push(arg);
    }
  }

  args.migrationName = positional[0] || null;
  return args;
}

function computeChecksum(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

async function checkRegistry(filename) {
  try {
    const res = await pool.query(
      "SELECT filename, checksum, validation_status FROM schema_migrations WHERE filename = $1",
      [filename]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
  } catch (e) {
    return null;
  }
}

async function recordInRegistry(filename, phase, checksum, status, rollbackFilename) {
  try {
    await pool.query(
      `INSERT INTO schema_migrations (filename, phase, checksum, validation_status, rollback_filename)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (filename) DO UPDATE SET
         checksum = EXCLUDED.checksum,
         validation_status = EXCLUDED.validation_status,
         rollback_filename = EXCLUDED.rollback_filename`,
      [filename, phase, checksum, status, rollbackFilename || null]
    );
  } catch (e) {
    console.error("Failed to record in schema_migrations registry:", e.message);
  }
}

async function updateRegistryStatus(filename, status) {
  try {
    await pool.query(
      "UPDATE schema_migrations SET validation_status = $1 WHERE filename = $2",
      [status, filename]
    );
  } catch (e) {
    console.error("Failed to update registry status:", e.message);
  }
}

async function runMigration() {
  const args = parseArgs(process.argv);

  try {
    if (!args.migrationName) {
      console.error(
        "Migration filename required. Example: node src/db/runMigration.js 2026-07-user-profile.sql --phase 1"
      );
      process.exitCode = 1;
      return;
    }

    const migrationPath = path.join(__dirname, "migrations", args.migrationName);

    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration not found: ${migrationPath}`);
      process.exitCode = 1;
      return;
    }

    const sql = fs.readFileSync(migrationPath, "utf8");
    const checksum = computeChecksum(sql);

    if (args.rollback) {
      await executeRollback(args, migrationPath, sql, checksum);
    } else if (args.validateOnly) {
      await executeValidateOnly(args);
    } else {
      await executeMigration(args, sql, checksum);
    }
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

async function executeMigration(args, sql, checksum) {
  const { migrationName, phase } = args;

  console.log(`Running migration: ${migrationName}${phase ? ` (phase ${phase})` : ""}`);

  if (phase) {
    const existing = await checkRegistry(migrationName);
    if (existing) {
      if (existing.checksum === checksum) {
        console.log(`Migration already applied with matching checksum. Skipping.`);
        return;
      }
      console.error(`CHECKSUM_MISMATCH: ${migrationName} was previously applied with a different checksum.`);
      console.error(`  Previous: ${existing.checksum}`);
      console.error(`  Current:  ${checksum}`);
      process.exitCode = 1;
      return;
    }

    const migrationValidator = require("../services/migrationValidator");
    console.log("Running pre-validation...");
    const preResult = await migrationValidator.preValidate(phase);
    if (!preResult.passed) {
      console.error("PRE_VALIDATION_FAILED:");
      preResult.checks
        .filter((c) => !c.passed)
        .forEach((c) => console.error(`  FAIL | ${c.name} | ${c.detail}`));
      process.exitCode = 1;
      return;
    }
    console.log("Pre-validation passed.");
    const preRowCounts = preResult.preRowCounts;

    await recordInRegistry(migrationName, phase, checksum, "pending", deriveRollbackFilename(migrationName));

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      console.log("Migration SQL executed successfully.");
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("MIGRATION_FAILED:", e.message);
      await updateRegistryStatus(migrationName, "failed");
      process.exitCode = 1;
      return;
    } finally {
      client.release();
    }

    console.log("Running post-validation...");
    const postResult = await migrationValidator.postValidate(phase, null, preRowCounts);
    if (postResult.passed) {
      await updateRegistryStatus(migrationName, "passed");
      console.log("Post-validation passed. Migration recorded as 'passed' in registry.");
    } else {
      await updateRegistryStatus(migrationName, "failed");
      console.error("POST_VALIDATION_FAILED:");
      postResult.checks
        .filter((c) => !c.passed)
        .forEach((c) => console.error(`  FAIL | ${c.name} | ${c.detail}`));
      process.exitCode = 1;
      return;
    }
  } else {
    await pool.query(sql);
    console.log(`Migration completed: ${migrationName}`);
  }
}

async function executeValidateOnly(args) {
  const { migrationName, phase } = args;

  if (!phase) {
    console.error("--validate-only requires --phase <N>");
    process.exitCode = 1;
    return;
  }

  console.log(`Validate-only mode for phase ${phase} (no DDL will be executed).`);

  const migrationValidator = require("../services/migrationValidator");
  console.log("Running pre-validation...");
  const preResult = await migrationValidator.preValidate(phase);

  if (preResult.passed) {
    console.log("Pre-validation PASSED:");
    preResult.checks.forEach((c) => console.log(`  PASS | ${c.name} | ${c.detail}`));
  } else {
    console.error("Pre-validation FAILED:");
    preResult.checks.forEach((c) =>
      c.passed
        ? console.log(`  PASS | ${c.name} | ${c.detail}`)
        : console.error(`  FAIL | ${c.name} | ${c.detail}`)
    );
    process.exitCode = 1;
  }
}

async function executeRollback(args, migrationPath, sql, checksum) {
  const { migrationName, phase, rollback } = args;

  const rollbackPath = path.join(__dirname, "migrations", rollback);
  if (!fs.existsSync(rollbackPath)) {
    console.error(`Rollback migration not found: ${rollbackPath}`);
    process.exitCode = 1;
    return;
  }

  const rollbackSql = fs.readFileSync(rollbackPath, "utf8");

  console.log(`Running rollback: ${rollback}`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(rollbackSql);
    await client.query("COMMIT");
    console.log("Rollback SQL executed successfully.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("ROLLBACK_FAILED:", e.message);
    process.exitCode = 1;
    return;
  } finally {
    client.release();
  }

  await updateRegistryStatus(migrationName, "rolled_back");
  console.log(`Migration ${migrationName} marked as 'rolled_back' in registry.`);
}

function deriveRollbackFilename(filename) {
  return filename.replace(/\.sql$/, "-rollback.sql");
}

runMigration();
