// Shared scheduling primitives: time math, the canonical set of fixed
// commitments for a day, and free-window finding. Used by study-block
// generation, the Balancer, and the check's non-overlap assertion — one source
// of truth so they can never disagree. Pure module.

import { WEEKDAYS } from '../util/dates.js';

export function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
export function toHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Parse "YYYY-MM-DD" as a LOCAL date (avoids the UTC-midnight weekday shift).
export function parseIsoLocal(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

// Default start times for a training session by type (§ used only for placing
// study around training; the real calendar time is set by the Balancer).
const TRAINING_START = { ride: '16:30', gym: '17:15', run: '16:30', default: '16:30' };

// The canonical fixed commitments for one date, in minutes-from-midnight.
// ctx: { plan, externalCal, social }
export function fixedCommitments(dateIso, ctx = {}) {
  const { plan = { sessions: [] }, externalCal = [], social = [] } = ctx;
  const weekday = parseIsoLocal(dateIso).getDay(); // 0=Sun
  const out = [];

  // Trips are all-day and block the whole day.
  const trip = externalCal.find((e) => e.kind === 'trip' && dateIso >= e.date && dateIso <= (e.endDate || e.date));
  if (trip) {
    return [{ start: 0, end: 24 * 60, kind: 'trip', label: trip.title }];
  }

  // School: explicit events for the date, else a default weekday school block.
  const schoolEvents = externalCal.filter((e) => e.kind === 'school' && e.date === dateIso && e.start && e.end);
  if (schoolEvents.length) {
    for (const e of schoolEvents) out.push({ start: toMin(e.start), end: toMin(e.end), kind: 'school', label: e.title });
  } else if (weekday >= 1 && weekday <= 5) {
    out.push({ start: toMin('08:15'), end: toMin('15:30'), kind: 'school', label: 'School' });
  }

  // Training session scheduled on this weekday.
  const dayName = WEEKDAYS[weekday];
  const session = (plan.sessions || []).find((s) => s.day === dayName && s.type !== 'rest' && s.durationMin > 0);
  if (session) {
    const start = toMin(TRAINING_START[session.type] || TRAINING_START.default);
    out.push({ start, end: start + session.durationMin, kind: 'training', label: `${session.type} (${session.intensity})`, sessionId: session.id });
  }

  // Confirmed social plans on this date.
  for (const p of social) {
    if (p.status !== 'confirmed') continue;
    const when = (p.when || '').slice(0, 10);
    if (when !== dateIso) continue;
    const t = (p.when || '').slice(11, 16) || '18:00';
    const start = toMin(t);
    out.push({ start, end: start + 120, kind: 'social', label: p.what });
  }

  return out.sort((a, b) => a.start - b.start);
}

// Free windows within [winStart,winEnd] after removing busy intervals.
export function freeWindows(winStart, winEnd, busy) {
  const sorted = busy
    .map((b) => ({ start: Math.max(b.start, winStart), end: Math.min(b.end, winEnd) }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);
  const free = [];
  let cursor = winStart;
  for (const b of sorted) {
    if (b.start > cursor) free.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < winEnd) free.push({ start: cursor, end: winEnd });
  return free;
}

// Place a block of `minutes` in the first free window that fits. Returns the
// interval or null.
export function placeBlock(minutes, freeList) {
  for (const w of freeList) {
    if (w.end - w.start >= minutes) return { start: w.start, end: w.start + minutes };
  }
  return null;
}
