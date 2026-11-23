const pool = require("../db/pool");
const {
  normaliseWorkspaceCode,
  getCanonicalCodes,
  loadActiveCodes,
} = require("./workspaceCodeRegistry");

class WorkspaceContextRequiredError extends Error {
  constructor(message) {
    super(message);
    this.code = "WORKSPACE_CONTEXT_REQUIRED";
    this.name = "WorkspaceContextRequiredError";
  }
}

class WorkspaceCodeUnrecognisedError extends Error {
  constructor(code) {
    super(`Workspace code not recognised: ${code}`);
    this.code = "WORKSPACE_CODE_UNRECOGNISED";
    this.name = "WorkspaceCodeUnrecognisedError";
  }
}

const CANONICAL_CODES = getCanonicalCodes();

function scopeTo(workspaceCode, options = {}) {
  if (!workspaceCode || String(workspaceCode).trim() === "") {
    throw new WorkspaceContextRequiredError(
      "workspaceCode is required for workspace scoping"
    );
  }

  const canonical = normaliseWorkspaceCode(workspaceCode);
  if (!canonical || !CANONICAL_CODES.includes(canonical)) {
    throw new WorkspaceCodeUnrecognisedError(workspaceCode);
  }

  const alias = options.alias || "t";
  const paramStart = options.paramStart || 1;

  return {
    sql: `${alias}.workspace = $${paramStart}`,
    params: [canonical],
  };
}

function scopeToMultiple(workspaceCodes, options = {}) {
  if (!workspaceCodes || !Array.isArray(workspaceCodes) || workspaceCodes.length === 0) {
    throw new WorkspaceContextRequiredError(
      "Non-empty workspaceCodes array is required for multi-workspace scoping"
    );
  }

  const canonicals = workspaceCodes.map((code) => {
    const canonical = normaliseWorkspaceCode(code);
    if (!canonical || !CANONICAL_CODES.includes(canonical)) {
      throw new WorkspaceCodeUnrecognisedError(code);
    }
    return canonical;
  });

  const alias = options.alias || "t";
  const paramStart = options.paramStart || 1;
  const placeholders = canonicals.map((_, i) => `$${paramStart + i}`).join(", ");

  return {
    sql: `${alias}.workspace IN (${placeholders})`,
    params: canonicals,
  };
}

function resolveWorkspaceFromRequest(req) {
  if (!req || !req.user) {
    throw new WorkspaceContextRequiredError(
      "req.user is required to resolve workspace"
    );
  }

  const user = req.user;

  if (user.workspace) {
    const canonical = normaliseWorkspaceCode(user.workspace);
    if (canonical) return canonical;
  }

  if (user.department) {
    const canonical = normaliseWorkspaceCode(user.department);
    if (canonical) return canonical;
  }

  if (req.financeAccess && req.financeAccess.isFinanceUser) {
    return "FIN";
  }

  if (user.role) {
    const roleLower = String(user.role).toLowerCase();
    if (roleLower.includes("finance")) return "FIN";
    if (roleLower.includes("it") || roleLower.includes("helpdesk") || roleLower.includes("agent")) return "IT";
    if (roleLower.includes("pdm") || roleLower.includes("process")) return "PDM";
    if (roleLower.includes("hr") || roleLower.includes("human")) return "HR";
    if (roleLower.includes("fac") || roleLower.includes("facilities")) return "FAC";
  }

  throw new WorkspaceContextRequiredError(
    "Could not resolve workspace from request context"
  );
}

async function validateWorkspaceCode(code) {
  if (!code) return false;
  const activeCodes = await loadActiveCodes();
  return activeCodes.includes(code);
}

function buildScopedQuery(baseSql, workspaceCode, paramStart = 1) {
  const scope = scopeTo(workspaceCode, { paramStart });

  const hasWhere = /\bWHERE\b/i.test(baseSql);
  const connector = hasWhere ? "AND" : "WHERE";

  const scopedSql = `${baseSql} ${connector} ${scope.sql}`;

  return {
    sql: scopedSql,
    params: scope.params,
  };
}

module.exports = {
  scopeTo,
  scopeToMultiple,
  resolveWorkspaceFromRequest,
  validateWorkspaceCode,
  normaliseWorkspaceCode,
  buildScopedQuery,
  CANONICAL_CODES,
  WorkspaceContextRequiredError,
  WorkspaceCodeUnrecognisedError,
};