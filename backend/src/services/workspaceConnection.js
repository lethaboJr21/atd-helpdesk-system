const pool = require("../db/pool");
const config = require("../config");
const { normaliseWorkspaceCode } = require("./workspaceCodeRegistry");

class WorkspaceContextRequiredError extends Error {
  constructor(message) {
    super(message);
    this.code = "WORKSPACE_CONTEXT_REQUIRED";
    this.name = "WorkspaceContextRequiredError";
  }
}

function safeSetting(value) {
  return String(value).replace(/[^a-zA-Z0-9_]/g, "");
}

async function acquireScoped(workspaceCode, userId) {
  if (!workspaceCode || String(workspaceCode).trim() === "") {
    throw new WorkspaceContextRequiredError(
      "workspaceCode is required for workspace-scoped connection"
    );
  }

  const canonical = normaliseWorkspaceCode(workspaceCode) || safeSetting(workspaceCode);
  const client = await pool.connect();

  try {
    await client.query(`SET app.workspace = '${canonical}'`);
    if (userId !== null && userId !== undefined) {
      const safeUserId = safeSetting(userId);
      await client.query(`SET app.user_id = '${safeUserId}'`);
    }
  } catch (e) {
    client.release();
    throw e;
  }

  return client;
}

async function releaseScoped(client) {
  if (!client) return;

  try {
    await client.query("RESET app.workspace");
    await client.query("RESET app.user_id");
  } catch (e) {
    // best effort reset
  } finally {
    client.release();
  }
}

async function withWorkspaceScope(workspaceCode, userId, callback) {
  const client = await acquireScoped(workspaceCode, userId);
  try {
    return await callback(client);
  } finally {
    await releaseScoped(client);
  }
}

async function withoutScope(callback) {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

module.exports = {
  acquireScoped,
  releaseScoped,
  withWorkspaceScope,
  withoutScope,
  WorkspaceContextRequiredError,
};