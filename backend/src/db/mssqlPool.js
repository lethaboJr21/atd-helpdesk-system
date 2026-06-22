const sql = require("mssql");

const hasPort = Boolean(process.env.MSSQL_PORT);

const config = {
  server: process.env.MSSQL_SERVER,
  database: process.env.MSSQL_DATABASE,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,

  ...(hasPort
    ? { port: Number(process.env.MSSQL_PORT) }
    : {}),

  options: {
    encrypt: process.env.MSSQL_ENCRYPT === "true",
    trustServerCertificate: process.env.MSSQL_TRUST_CERT === "true",

    ...(process.env.MSSQL_INSTANCE
      ? { instanceName: process.env.MSSQL_INSTANCE }
      : {}),
  },

  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },

  connectionTimeout: 30000,
  requestTimeout: 60000,
};

let poolPromise;

function getMssqlPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config);
  }

  return poolPromise;
}

module.exports = {
  sql,
  getMssqlPool,
};