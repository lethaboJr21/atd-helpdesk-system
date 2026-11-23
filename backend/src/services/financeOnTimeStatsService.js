"use strict";
const pool = require("../db/pool");
const financePeriodService = require("./financePeriodService");
const { resolveScope, userDimensionMap, scopeClause, queryTolerant } = require("./financeEnterpriseReportingService");

const ITEM_TYPES = ["ticket", "journal", "reconciliation", "month_end"];
const ROLLUP_DIMENSIONS = new Set(["employee", "finance_function", "office", "department"]);
const MAX_TREND_WINDOWS = 12;
const TYPE_DEFS = {
  ticket: { table: "tickets", ownerColumn: "assigned_to_user_id", submission: "closed_at", extraWhere: "workspace='FIN' AND archived_at IS NULL" },
  journal: { table: "finance_journals", ownerColumn: "preparer_user_id", submission: "submitted_at", extraWhere: null },
  reconciliation: { table: "finance_reconciliations", ownerColumn: "owner_user_id", submission: "COALESCE(reviewed_at, approved_at, closed_at)", extraWhere: null },
  month_end: { table: "finance_close_tasks", ownerColumn: "owner_user_id", submission: "completed_at", extraWhere: null }
};

function fail(status, code, message) { return Object.assign(new Error(message), { status, code }); }
function round1(value) { return Math.round(value * 10) / 10; }
function isMonthlyKey(value) { return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value); }
function nextMonthKey(key) {
  const [year, month] = key.split("-").map(Number);
  const total = year * 12 + month;
  const shiftedYear = Math.floor(total / 12);
  const shiftedMonth = total - shiftedYear * 12 + 1;
  return `${String(shiftedYear).padStart(4, "0")}-${String(shiftedMonth).padStart(2, "0")}`;
}

function resolveTypes(itemType) {
  if (itemType === undefined || itemType === null) return ITEM_TYPES.slice();
  if (!ITEM_TYPES.includes(itemType)) throw fail(400, "INVALID_ITEM_TYPE", "itemType must be one of ticket, journal, reconciliation, month_end.");
  return [itemType];
}

async function resolveOwnerFilter({ scopeIds, employeeUserId, financeFunction, officeCode, department }) {
  if (employeeUserId !== undefined && employeeUserId !== null) {
    const employeeId = Number(employeeUserId);
    if (!Number.isFinite(employeeId)) throw fail(400, "INVALID_EMPLOYEE_FILTER", "employeeUserId must be a numeric user id.");
    if (scopeIds !== null && !scopeIds.includes(employeeId)) throw fail(403, "REPORT_SCOPE_DENIED", "The requested employee is outside the authorised reporting scope.");
  }
  let filterIds = null;
  if (financeFunction) {
    const rows = await queryTolerant(`SELECT user_id FROM finance_employee_responsibilities WHERE finance_function=$1 AND active=TRUE`, [financeFunction]);
    filterIds = Array.from(new Set(rows.map(row => Number(row.user_id))));
  } else if (officeCode) {
    const rows = await queryTolerant(`SELECT user_id FROM finance_employee_responsibilities WHERE office_code=$1 AND active=TRUE`, [officeCode]);
    filterIds = Array.from(new Set(rows.map(row => Number(row.user_id))));
  } else if (department) {
    const rows = await queryTolerant(`SELECT id FROM users WHERE LOWER(department)=LOWER($1) AND archived_at IS NULL`, [department]);
    filterIds = Array.from(new Set(rows.map(row => Number(row.id))));
  }
  if (employeeUserId !== undefined && employeeUserId !== null) {
    const employeeId = Number(employeeUserId);
    filterIds = filterIds === null ? [employeeId] : filterIds.includes(employeeId) ? [employeeId] : [];
  }
  if (filterIds !== null && scopeIds !== null) filterIds = filterIds.filter(id => scopeIds.includes(id));
  return filterIds;
}

async function computeWindow({ start, end, restrictIds, types }) {
  const warnings = [];
  const typesData = [];
  for (const type of types) {
    const def = TYPE_DEFS[type];
    const scope = scopeClause(restrictIds, def.ownerColumn, 3);
    const dueSql = "COALESCE(effective_due_at, original_due_at, due_at)";
    let rows;
    try {
      const result = await pool.query(`SELECT ${def.ownerColumn} owner_id, COUNT(*) total, COUNT(*) FILTER (WHERE ${def.submission} <= ${dueSql}) on_time, COUNT(*) FILTER (WHERE ${def.submission} > ${dueSql}) late FROM ${def.table} WHERE ${def.submission} IS NOT NULL AND ${def.submission} >= $1 AND ${def.submission} < $2${def.extraWhere ? ` AND ${def.extraWhere}` : ""} AND ${scope.sql} GROUP BY ${def.ownerColumn}`, [start, end, ...scope.params]);
      rows = result.rows;
    } catch (error) {
      if (["42P01", "42703"].includes(error.code)) { warnings.push(`${type.toUpperCase()}_OMITTED`); continue; }
      throw error;
    }
    const owners = new Map();
    rows.forEach(row => owners.set(Number(row.owner_id), { on_time: Number(row.on_time), late: Number(row.late), total: Number(row.total) }));
    typesData.push({ itemType: type, owners });
  }
  return { typesData, warnings };
}

function summarizeTypes(typesData) {
  return typesData.map(({ itemType, owners }) => {
    let onTime = 0;
    let late = 0;
    let total = 0;
    owners.forEach(stats => { onTime += stats.on_time; late += stats.late; total += stats.total; });
    return { itemType, onTime, late, total, onTimePct: total > 0 ? round1(onTime * 100 / total) : null };
  });
}

function dimensionValueOf(profile, dimension, ownerId) {
  if (dimension === "employee") return (profile && profile.name) || String(ownerId);
  if (!profile) return "Unassigned";
  if (dimension === "finance_function") return profile.finance_function || "Unassigned";
  if (dimension === "office") return profile.office_code || "Unassigned";
  return profile.department || "Unassigned";
}

async function buildRollup(dimension, typesData) {
  const allOwnerIds = Array.from(new Set(typesData.flatMap(({ owners }) => Array.from(owners.keys()))));
  const dimMap = allOwnerIds.length ? await userDimensionMap(allOwnerIds) : new Map();
  const groups = new Map();
  for (const { itemType, owners } of typesData) {
    for (const [ownerId, stats] of owners) {
      const value = dimensionValueOf(dimMap.get(ownerId), dimension, ownerId);
      if (!groups.has(value)) groups.set(value, new Map());
      const group = groups.get(value);
      if (!group.has(itemType)) group.set(itemType, { onTime: 0, late: 0, total: 0 });
      const acc = group.get(itemType);
      acc.onTime += stats.on_time;
      acc.late += stats.late;
      acc.total += stats.total;
    }
  }
  const computedTypes = typesData.map(entry => entry.itemType);
  return Array.from(groups.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map(([value, group]) => ({
    dimensionValue: value,
    byItemType: computedTypes.map(type => {
      const acc = group.get(type) || { onTime: 0, late: 0, total: 0 };
      return { itemType: type, onTime: acc.onTime, late: acc.late, total: acc.total, onTimePct: acc.total > 0 ? round1(acc.onTime * 100 / acc.total) : null };
    })
  }));
}

async function getOnTimeStatistics({ requestingUser, window, dimension, itemType, employeeUserId, financeFunction, officeCode, department } = {}) {
  const types = resolveTypes(itemType);
  if (dimension !== undefined && dimension !== null && !ROLLUP_DIMENSIONS.has(dimension)) throw fail(400, "INVALID_ROLLUP_DIMENSION", "dimension must be employee, finance_function, office, or department.");
  const resolvedWindow = financePeriodService.resolveStatsWindow(window);
  const { scopeIds } = await resolveScope(requestingUser);
  const ownerFilter = await resolveOwnerFilter({ scopeIds, employeeUserId, financeFunction, officeCode, department });
  const restrictIds = ownerFilter !== null ? ownerFilter : scopeIds;
  const { typesData, warnings } = await computeWindow({ start: resolvedWindow.start, end: resolvedWindow.end, restrictIds, types });
  const byItemType = summarizeTypes(typesData);
  if (!byItemType.length || byItemType.every(entry => entry.total === 0)) warnings.push("NO_DATA_FOR_PERIOD");
  const result = { window: { start: resolvedWindow.start, end: resolvedWindow.end, label: resolvedWindow.label }, byItemType, warnings, generatedAt: new Date().toISOString() };
  if (dimension !== undefined && dimension !== null) result.rollup = await buildRollup(dimension, typesData);
  return result;
}

function normalizeTrendWindows(windows) {
  if (Array.isArray(windows)) {
    if (!windows.length) throw fail(400, "INVALID_WINDOWS", "windows must contain at least one window spec.");
    if (windows.length > MAX_TREND_WINDOWS) throw fail(400, "TOO_MANY_WINDOWS", `A maximum of ${MAX_TREND_WINDOWS} windows is supported.`);
    return windows;
  }
  if (windows && typeof windows === "object") {
    if (!isMonthlyKey(windows.fromMonth) || !isMonthlyKey(windows.toMonth)) throw fail(400, "INVALID_WINDOWS", "fromMonth and toMonth must be valid YYYY-MM month keys.");
    if (windows.fromMonth > windows.toMonth) throw fail(400, "INVALID_WINDOWS", "fromMonth must not exceed toMonth.");
    const specs = [];
    let cursor = windows.fromMonth;
    while (cursor <= windows.toMonth) {
      specs.push({ month: cursor });
      if (specs.length > MAX_TREND_WINDOWS) throw fail(400, "TOO_MANY_WINDOWS", `A maximum of ${MAX_TREND_WINDOWS} windows is supported.`);
      cursor = nextMonthKey(cursor);
    }
    return specs;
  }
  throw fail(400, "INVALID_WINDOWS", "windows must be an array of window specs or an object with fromMonth and toMonth.");
}

async function getOnTimeTrend({ requestingUser, windows, itemType } = {}) {
  const types = resolveTypes(itemType);
  const specs = normalizeTrendWindows(windows);
  const { scopeIds } = await resolveScope(requestingUser);
  const series = [];
  let previousValue = null;
  for (const spec of specs) {
    const resolvedWindow = financePeriodService.resolveStatsWindow(spec);
    const { typesData, warnings } = await computeWindow({ start: resolvedWindow.start, end: resolvedWindow.end, restrictIds: scopeIds, types });
    warnings.forEach(warning => console.warn(`On-time trend window ${resolvedWindow.label}: ${warning}`));
    const byItemType = summarizeTypes(typesData);
    const total = byItemType.reduce((sum, entry) => sum + entry.total, 0);
    const onTime = byItemType.reduce((sum, entry) => sum + entry.onTime, 0);
    const onTimePct = total > 0 ? round1(onTime * 100 / total) : null;
    series.push({ window: { start: resolvedWindow.start, end: resolvedWindow.end, label: resolvedWindow.label }, onTimePct, previousValue, changePoints: onTimePct !== null && previousValue !== null ? round1(onTimePct - previousValue) : null });
    previousValue = onTimePct;
  }
  return series;
}

module.exports = { getOnTimeStatistics, getOnTimeTrend, ITEM_TYPES };