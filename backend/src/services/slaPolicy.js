const { getSetting } = require("./systemSettings");

const POLICY_KEY = "sla.priority_policy";
const SYSPRO_POLICY_KEY = "sla.service.syspro_erp";

const DEFAULT_POLICY = Object.freeze({
  version: 1,
  timezone: "Africa/Johannesburg",
  clock: "elapsed",
  priorities: {
    Critical: { responseMinutes: 15, resolutionMinutes: 240 },
    High: { responseMinutes: 30, resolutionMinutes: 480 },
    Medium: { responseMinutes: 240, resolutionMinutes: 2880 },
    Low: { responseMinutes: 480, resolutionMinutes: 7200 },
  },
});

const SYSPRO_RESPONSE_POLICY = Object.freeze({
  key: SYSPRO_POLICY_KEY,
  version: 1,
  service: "Syspro/ERP",
  responseOnly: true,
  priorities: {
    Critical: 30,
    High: 180,
    Medium: 1440,
    Low: 2880,
  },
});

const SYSPRO_TERMS = Object.freeze([
  "syspro",
  "erp",
  "enterprise resource planning",
]);

function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function normalizePolicy(value) {
  const source = value && typeof value === "object" ? value : {};
  const incoming = source.priorities && typeof source.priorities === "object"
    ? source.priorities
    : {};
  const priorities = {};
  for (const name of Object.keys(DEFAULT_POLICY.priorities)) {
    const fallback = DEFAULT_POLICY.priorities[name];
    const row = incoming[name] || {};
    priorities[name] = {
      responseMinutes: positive(row.responseMinutes, fallback.responseMinutes),
      resolutionMinutes: positive(row.resolutionMinutes, fallback.resolutionMinutes),
    };
  }
  return {
    version: positive(source.version, 1),
    timezone: String(source.timezone || DEFAULT_POLICY.timezone),
    clock: ["elapsed", "business"].includes(source.clock) ? source.clock : "elapsed",
    priorities,
  };
}

function normalizeContext(context) {
  if (!context || typeof context !== "object") return "";
  return [
    context.workspace,
    context.ticketType,
    context.category,
    context.subCategory,
    context.itemCategory,
    context.title,
  ]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean)
    .join(" | ");
}

function isSysproErpContext(context) {
  const searchable = normalizeContext(context);
  return SYSPRO_TERMS.some((term) => searchable.includes(term));
}

async function getSlaPolicy(database) {
  return normalizePolicy(await getSetting(POLICY_KEY, DEFAULT_POLICY, database));
}

function targetFor(policy, priority) {
  return policy.priorities[priority] || policy.priorities.Medium;
}

function resolveSlaTarget(policy, priority, context = {}) {
  const defaultTarget = targetFor(policy, priority);
  if (!isSysproErpContext(context)) {
    return {
      policyKey: POLICY_KEY,
      policyVersion: policy.version,
      service: null,
      responseOnlyOverride: false,
      responseMinutes: defaultTarget.responseMinutes,
      resolutionMinutes: defaultTarget.resolutionMinutes,
    };
  }

  return {
    policyKey: SYSPRO_RESPONSE_POLICY.key,
    policyVersion: SYSPRO_RESPONSE_POLICY.version,
    service: SYSPRO_RESPONSE_POLICY.service,
    responseOnlyOverride: true,
    responseMinutes: SYSPRO_RESPONSE_POLICY.priorities[priority]
      || SYSPRO_RESPONSE_POLICY.priorities.Medium,
    resolutionMinutes: defaultTarget.resolutionMinutes,
  };
}

function calculateSla(policy, priority, startedAt = new Date(), context = {}) {
  const start = new Date(startedAt);
  const target = resolveSlaTarget(policy, priority, context);
  return {
    policyKey: target.policyKey,
    policyVersion: target.policyVersion,
    clock: policy.clock,
    timezone: policy.timezone,
    service: target.service,
    responseOnlyOverride: target.responseOnlyOverride,
    responseMinutes: target.responseMinutes,
    resolutionMinutes: target.resolutionMinutes,
    responseDueAt: new Date(start.getTime() + target.responseMinutes * 60000),
    resolutionDueAt: new Date(start.getTime() + target.resolutionMinutes * 60000),
  };
}

module.exports = {
  POLICY_KEY,
  SYSPRO_POLICY_KEY,
  DEFAULT_POLICY,
  SYSPRO_RESPONSE_POLICY,
  getSlaPolicy,
  isSysproErpContext,
  resolveSlaTarget,
  calculateSla,
};
