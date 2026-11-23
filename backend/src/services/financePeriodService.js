const pool = require("../db/pool");

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });

const CADENCES = ["monthly", "quarterly", "biannual", "annual"];
const PERIOD_TYPES = { monthly: "Monthly", quarterly: "Quarterly", biannual: "Biannual", annual: "Annual" };

const pad2 = (value) => String(value).padStart(2, "0");

function monthKeysFor(year, fromMonth, toMonth) {
  const keys = [];
  for (let month = fromMonth; month <= toMonth; month++) keys.push(`${year}-${pad2(month)}`);
  return keys;
}

function resolvePeriodKey(periodKey) {
  if (typeof periodKey !== "string" || periodKey.trim() === "") {
    throw fail(400, "INVALID_PERIOD_KEY", "A period key (YYYY-MM, YYYY-Q1..Q4, YYYY-H1/H2 or YYYY) is required.");
  }
  const key = periodKey.trim();
  let year = null;
  let fromMonth = null;
  let toMonth = null;
  let cadence = null;
  let match = /^(\d{4})-(\d{2})$/.exec(key);
  if (match) {
    const month = Number(match[2]);
    if (month < 1 || month > 12) throw fail(400, "INVALID_PERIOD_KEY", `"${key}" is not a valid period key.`);
    year = Number(match[1]);
    fromMonth = month;
    toMonth = month;
    cadence = "monthly";
  } else if ((match = /^(\d{4})-Q([1-4])$/.exec(key))) {
    const quarter = Number(match[2]);
    year = Number(match[1]);
    fromMonth = quarter * 3 - 2;
    toMonth = quarter * 3;
    cadence = "quarterly";
  } else if ((match = /^(\d{4})-H([1-2])$/.exec(key))) {
    const half = Number(match[2]);
    year = Number(match[1]);
    fromMonth = half * 6 - 5;
    toMonth = half * 6;
    cadence = "biannual";
  } else if ((match = /^(\d{4})$/.exec(key))) {
    year = Number(match[1]);
    fromMonth = 1;
    toMonth = 12;
    cadence = "annual";
  } else {
    throw fail(400, "INVALID_PERIOD_KEY", `"${key}" is not a valid period key.`);
  }
  const monthlyKeys = monthKeysFor(year, fromMonth, toMonth);
  const windowStart = `${year}-${pad2(fromMonth)}-01`;
  const windowEnd = `${year}-${pad2(toMonth)}-${pad2(new Date(Date.UTC(year, toMonth, 0)).getUTCDate())}`;
  return { cadence, periodKey: key, windowStart, windowEnd, monthlyKeys, fromMonth: monthlyKeys[0], toMonth: monthlyKeys[monthlyKeys.length - 1] };
}

function assertValidCadence(cadence) {
  if (!CADENCES.includes(cadence)) {
    throw fail(400, "INVALID_CADENCE", "Measurement cadence must be one of: monthly, quarterly, biannual, annual.");
  }
  return cadence;
}

function containedMonthlyKeys(periodKey) {
  return resolvePeriodKey(periodKey).monthlyKeys;
}

function parseDayDate(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  return utc;
}

function dayBoundary(dateUtc) {
  return new Date(Date.UTC(dateUtc.getUTCFullYear(), dateUtc.getUTCMonth(), dateUtc.getUTCDate()));
}

function addDays(dateUtc, days) {
  return new Date(dateUtc.getTime() + days * 86400000);
}

function parseMonthValue(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function parseYearValue(value) {
  if (typeof value !== "string" || !/^\d{4}$/.test(value.trim())) return null;
  return Number(value.trim());
}

function isoWeekMonday(isoYear) {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Dow = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  return addDays(dayBoundary(jan4), 1 - jan4Dow);
}

function resolveStatsWindow({ periodKey, month, year, from, to, isoWeek, isoYear, day } = {}) {
  let start = null;
  let end = null;
  let label = null;
  if (periodKey != null && String(periodKey).trim() !== "") {
    const resolved = resolvePeriodKey(periodKey);
    start = dayBoundary(parseDayDate(resolved.windowStart));
    end = addDays(dayBoundary(parseDayDate(resolved.windowEnd)), 1);
    label = resolved.periodKey;
  } else if (day != null && String(day).trim() !== "") {
    const parsed = parseDayDate(day);
    if (!parsed) throw fail(400, "INVALID_TIME_RANGE", `"${day}" is not a valid day (YYYY-MM-DD).`);
    start = dayBoundary(parsed);
    end = addDays(start, 1);
    label = String(day).trim();
  } else if (isoWeek != null && isoYear != null) {
    const week = Number(isoWeek);
    const isoYr = parseYearValue(isoYear);
    if (!Number.isInteger(week) || week < 1 || week > 53 || isoYr == null) {
      throw fail(400, "INVALID_TIME_RANGE", "isoWeek must be an integer 1-53 and isoYear a 4-digit year.");
    }
    start = addDays(isoWeekMonday(isoYr), (week - 1) * 7);
    if (start.getTime() >= isoWeekMonday(isoYr + 1).getTime()) {
      throw fail(400, "INVALID_TIME_RANGE", `ISO year ${isoYr} does not have ${week} ISO weeks.`);
    }
    end = addDays(start, 7);
    label = `ISO week ${week} of ${isoYr}`;
  } else if (month != null && String(month).trim() !== "") {
    const parsed = parseMonthValue(month);
    if (!parsed) throw fail(400, "INVALID_TIME_RANGE", `"${month}" is not a valid month (YYYY-MM).`);
    start = new Date(Date.UTC(parsed.year, parsed.month - 1, 1));
    end = parsed.month === 12 ? new Date(Date.UTC(parsed.year + 1, 0, 1)) : new Date(Date.UTC(parsed.year, parsed.month, 1));
    label = `${parsed.year}-${pad2(parsed.month)}`;
  } else if (year != null && String(year).trim() !== "") {
    const yr = parseYearValue(year);
    if (yr == null) throw fail(400, "INVALID_TIME_RANGE", `"${year}" is not a valid year (YYYY).`);
    start = new Date(Date.UTC(yr, 0, 1));
    end = new Date(Date.UTC(yr + 1, 0, 1));
    label = String(yr);
  } else if (from != null && to != null && String(from).trim() !== "" && String(to).trim() !== "") {
    const fromDay = parseDayDate(from);
    const toDay = parseDayDate(to);
    if (!fromDay || !toDay) throw fail(400, "INVALID_TIME_RANGE", "from and to must be valid dates (YYYY-MM-DD).");
    start = dayBoundary(fromDay);
    end = addDays(dayBoundary(toDay), 1);
    label = `${String(from).trim()} to ${String(to).trim()}`;
  } else {
    throw fail(400, "INVALID_TIME_RANGE", "A window is required: periodKey, day, isoWeek with isoYear, month, year, or from with to.");
  }
  if (end.getTime() < start.getTime()) {
    throw fail(400, "INVALID_TIME_RANGE", "Window end must not precede window start.");
  }
  return { start: start.toISOString(), end: end.toISOString(), label };
}

async function registerPeriodWindow(periodKey) {
  const resolved = resolvePeriodKey(periodKey);
  const label = resolved.monthlyKeys.length === 1 ? resolved.periodKey : `${resolved.fromMonth} to ${resolved.toMonth}`;
  try {
    await pool.query(
      `INSERT INTO finance_kpi_periods(period_type,period_key,period_start,period_end,label) VALUES($1,$2,$3,$4,$5) ON CONFLICT(period_key) DO NOTHING`,
      [PERIOD_TYPES[resolved.cadence], resolved.periodKey, resolved.windowStart, resolved.windowEnd, label]
    );
  } catch (error) {
    console.warn(`Period window registration skipped for "${resolved.periodKey}": ${error.message}`);
  }
  return resolved;
}

module.exports = { CADENCES, resolvePeriodKey, assertValidCadence, containedMonthlyKeys, resolveStatsWindow, registerPeriodWindow };