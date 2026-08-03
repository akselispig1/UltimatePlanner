// Training (§3.1): resolve the weekly plan onto dates, match completion against
// activity data, compute rolling load, and flag missed sessions. Pure module.

import { today, addDays, isoDate, weekdayName, offsetToIso } from '../util/dates.js';
import { WEEKDAYS } from '../util/dates.js';

// Resolve the weekly plan to concrete dated sessions across an inclusive offset
// range (e.g. -14..0). Rest days are included so the UI can show them.
export function datedSessions(plan, fromOffset, toOffset, now = new Date()) {
  const out = [];
  for (let off = fromOffset; off <= toOffset; off++) {
    const date = offsetToIso(off, now);
    const day = weekdayName(addDays(today(now), off));
    const session = (plan.sessions || []).find((s) => s.day === day);
    if (session) out.push({ ...session, date, day });
  }
  return out;
}

// Does an activity satisfy a planned session on the same date? Match on type and
// rough duration (§3.1).
export function activityMatches(session, activity) {
  if (session.type === 'rest') return false;
  if (activity.type !== session.type) return false;
  if (session.durationMin <= 0) return true;
  const tolerance = Math.max(20, session.durationMin * 0.4);
  return Math.abs(activity.durationMin - session.durationMin) <= tolerance;
}

export function actualNote(activity) {
  const bits = [`${activity.durationMin}min`];
  if (activity.climbingM) bits.push(`${activity.climbingM}m climbing`);
  else if (activity.distanceM) bits.push(`${(activity.distanceM / 1000).toFixed(1)}km`);
  return '✓ ' + bits.join(', ');
}

// Annotate each dated session with completion status from activities.
export function withCompletion(sessions, activities, now = new Date()) {
  const todayIso = isoDate(today(now));
  return sessions.map((s) => {
    if (s.type === 'rest') return { ...s, status: 'rest' };
    const act = activities.find((a) => a.date === s.date && activityMatches(s, a));
    if (act) return { ...s, status: 'done', activity: act, note: actualNote(act) };
    if (s.date < todayIso) return { ...s, status: 'missed' };
    return { ...s, status: 'planned' };
  });
}

// Rolling load: total activity minutes over the last 7 and 28 days, plus a
// per-day series for the 28-day window (for charts).
export function computeLoad(activities, now = new Date()) {
  const byDate = {};
  for (const a of activities) byDate[a.date] = (byDate[a.date] || 0) + a.durationMin;
  let sevenDay = 0;
  let twentyEightDay = 0;
  const series = [];
  for (let off = -27; off <= 0; off++) {
    const date = offsetToIso(off, now);
    const mins = byDate[date] || 0;
    series.push({ date, minutes: mins });
    twentyEightDay += mins;
    if (off >= -6) sevenDay += mins;
  }
  return { sevenDay, twentyEightDay, series };
}

// Missed sessions in the recent past (planned, not rest, no matching activity).
export function missedSessions(plan, activities, now = new Date(), lookbackDays = 14) {
  const sessions = datedSessions(plan, -lookbackDays, -1, now);
  return withCompletion(sessions, activities, now).filter((s) => s.status === 'missed');
}

export { WEEKDAYS };
