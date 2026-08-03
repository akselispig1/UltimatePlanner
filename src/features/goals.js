// Goals (§3.6). Progress is ALWAYS computed from real synced data, never asserted
// by the model. Performance goals with no computable metric are shown as
// manually tracked rather than faked. Pure module.

import { offsetToIso, today, isoDate } from '../util/dates.js';

// data: { activities, assignments, sleep, now }
export function computeProgress(goal, data = {}) {
  const { activities = [], assignments = [], now = new Date() } = data;
  switch (goal.metric) {
    case 'weekly_ride_hours': {
      const weekAgo = offsetToIso(-6, now);
      const mins = activities
        .filter((a) => a.type === 'ride' && a.date >= weekAgo)
        .reduce((sum, a) => sum + a.durationMin, 0);
      const hours = mins / 60;
      return {
        value: Math.round(hours * 10) / 10,
        unit: 'h this week',
        pct: Math.max(0, Math.min(100, Math.round((hours / goal.targetValue) * 100))),
        computed: true,
      };
    }
    case 'late_assignments': {
      const todayIso = isoDate(today(now));
      const late = assignments.filter((a) => a.status === 'open' && a.due < todayIso).length;
      return {
        value: late,
        unit: 'late',
        pct: late === 0 ? 100 : Math.max(0, 100 - late * 34),
        computed: true,
      };
    }
    default:
      return { value: null, unit: '', pct: null, computed: false, note: 'Tracked manually — log a result to update.' };
  }
}

export function withProgress(goals, data) {
  return goals.map((g) => ({ ...g, progress: computeProgress(g, data) }));
}
