const { Pool } = require("pg");
require("dotenv").config();

/**
 * ✅ PostgreSQL connection pool
 * Supports either DATABASE_URL or separate DB_* variables.
 */

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

const pool = new Pool(
  hasDatabaseUrl
    ? {
        //  Use DATABASE_URL if it exists
        connectionString: process.env.DATABASE_URL,

        // ✅ Development-safe pool settings
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
    : {
        // ✅ Use separate DB variables if DATABASE_URL is not set
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: String(process.env.DB_PASSWORD || ""),

        // ✅ Development-safe pool settings
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
);

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err.message);
});

module.exports = pool;