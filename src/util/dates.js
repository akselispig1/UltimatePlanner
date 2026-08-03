// Date helpers. Pure functions, no DOM — importable in Node and browser.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Midnight of "today" in local time. A single source of truth so fixtures,
// views and the check all agree on the reference point.
export function today(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// ISO date only, e.g. 2026-08-03.
export function isoDate(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Resolve a day offset (relative to today) into an ISO date string.
export function offsetToIso(offset, now = new Date()) {
  return isoDate(addDays(today(now), offset));
}

export function weekdayName(date) {
  return WEEKDAYS[new Date(date).getDay()];
}

// Whole days between two dates (b - a), ignoring time of day.
export function daysBetween(a, b) {
  return Math.round((today(b) - today(a)) / DAY_MS);
}

// YYYY-MM key for chat history files.
export function monthKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Deterministic pseudo-random in [0,1) from an integer seed. Lets fixtures look
// noisy but stay identical across runs.
export function seeded(seed) {
  let x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
