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
    max: Number(process.env.MSSQL_POOL_MAX || 10),
    min: 0,
    idleTimeoutMillis: Number(process.env.MSSQL_POOL_IDLE_TIMEOUT_MS || 30000),
  },

  connectionTimeout: Number(process.env.MSSQL_CONNECTION_TIMEOUT_MS || 30000),
  requestTimeout: Number(process.env.MSSQL_REQUEST_TIMEOUT_MS || 60000),
};

let poolPromise;
let lastConnectFailed = false;

function getMssqlPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config);
    poolPromise.then((pool) => {
      pool.on("error", (err) => {
        console.error(JSON.stringify({ errorCode: "MSSQL_POOL_ERROR", errorClass: err?.name, message: err?.message, timestamp: new Date().toISOString() }));
      });
      if (lastConnectFailed) {
        lastConnectFailed = false;
        console.log(JSON.stringify({ errorCode: "MSSQL_CONNECT_RECOVERED", timestamp: new Date().toISOString() }));
      }
    }).catch((err) => {
      lastConnectFailed = true;
      console.error(JSON.stringify({ errorCode: "MSSQL_CONNECT_FAILED", errorClass: err?.name, message: err?.message, timestamp: new Date().toISOString() }));
      poolPromise = null; // reset poisoned state — the next getMssqlPool() call reconnects
    });
  }

  return poolPromise;
}

module.exports = {
  sql,
  getMssqlPool,
};
