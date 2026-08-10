/**
 * Temporary hardcoded shift roster (per Resego, 2026-08-05) — replace with a
 * proper shift admin screen later.
 *
 * - Pearl: fixed morning shift 07:00–16:00 (interim arrangement).
 * - Clinton and Zintle alternate weekly between the afternoon shift
 *   (14:00–22:00) and the night shift (22:00–06:00). Week of Monday
 *   2026-08-03: Clinton afternoon, Zintle night; they swap every week.
 *
 * Times are server-local (SAST). Agents not on this roster are treated as
 * regular office-hours staff and never marked off shift.
 */

const ANCHOR_MONDAY = new Date(2026, 7, 3); // Mon 3 Aug 2026: Clinton = afternoon

const SHIFTS = {
  morning: { label: "Morning shift", start: 7, end: 16 },
  afternoon: { label: "Afternoon shift", start: 14, end: 22 },
  night: { label: "Night shift", start: 22, end: 6 },
};

function weeksSinceAnchor(now) {
  return Math.floor((now - ANCHOR_MONDAY) / (7 * 24 * 3600 * 1000));
}

/** first-name → shift key for the week containing `now` */
function rosterFor(now = new Date()) {
  const swapped = Math.abs(weeksSinceAnchor(now)) % 2 === 1;
  return {
    pearl: "morning",
    clinton: swapped ? "night" : "afternoon",
    zintle: swapped ? "afternoon" : "night",
  };
}

function isOnShift(shiftKey, now = new Date()) {
  const shift = SHIFTS[shiftKey];
  const hour = now.getHours() + now.getMinutes() / 60;
  if (shift.start < shift.end) return hour >= shift.start && hour < shift.end;
  return hour >= shift.start || hour < shift.end; // spans midnight
}

/** Shift info for an agent, or null when they are not on the rotating roster. */
function shiftInfoForName(name, now = new Date()) {
  const firstName = String(name || "").trim().toLowerCase().split(/\s+/)[0];
  const shiftKey = rosterFor(now)[firstName];
  if (!shiftKey) return null;
  return {
    shiftKey,
    label: SHIFTS[shiftKey].label,
    onShift: isOnShift(shiftKey, now),
  };
}

module.exports = { shiftInfoForName, rosterFor };
