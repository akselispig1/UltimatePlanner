// Compact chat context snapshot (§3.6). Every message sends a small JSON summary
// of current state: active goals, last 14 days of training with completion, last
// 7 nights of sleep, recent nutrition notes, weight trend, open assignments +
// due dates, and the upcoming calendar week. Kept small — older data summarised,
// never raw API dumps. Pure module (state is passed in).

import { datedSessions, withCompletion, computeLoad } from './features/training.js';
import { sleepSummary } from './features/recovery.js';
import { withProgress } from './features/goals.js';
import { weightTrend } from './features/nutrition.js';
import { fixedCommitments, toHHMM } from './features/schedule.js';
import { offsetToIso, isoDate, today, daysBetween } from './util/dates.js';

export function buildSnapshot(state) {
  const { now, activities, sleep, assignments, plan, goals, logs, social, externalCal } = state;

  const training = withCompletion(datedSessions(plan, -14, 0, now), activities, now).map((s) => ({
    date: s.date,
    type: s.type,
    intensity: s.intensity,
    status: s.status,
  }));

  const sleepS = sleepSummary(sleep, now);
  const goalsWithProgress = withProgress(
    goals.filter((g) => g.status === 'active'),
    { activities, assignments, now }
  ).map((g) => ({ title: g.title, type: g.type, target: g.target, progress: g.progress.value, pct: g.progress.pct }));

  const trend = weightTrend(logs, now);
  const nutritionNotes = logs
    .filter((e) => e.kind === 'nutrition')
    .slice(-3)
    .map((e) => ({ at: e.at, text: e.text }));

  const todayIso = isoDate(today(now));
  const openAssignments = assignments
    .filter((a) => a.status === 'open' && a.due >= todayIso)
    .sort((a, b) => (a.due < b.due ? -1 : 1))
    .slice(0, 8)
    .map((a) => ({ title: a.title, course: a.course, due: a.due, weight: a.weight }));

  const week = [];
  for (let off = 0; off <= 6; off++) {
    const date = offsetToIso(off, now);
    const commitments = fixedCommitments(date, { plan, externalCal, social }).map((c) => `${c.kind} ${toHHMM(c.start)}-${toHHMM(c.end)}`);
    week.push({ date, commitments });
  }

  const load = computeLoad(activities, now);

  return {
    today: todayIso,
    goals: goalsWithProgress,
    trainingLast14: training,
    load: { sevenDayMin: load.sevenDay, twentyEightDayMin: load.twentyEightDay },
    sleepLast7: (sleepS.series || []).map((s) => ({ date: s.date, score: s.score, durationMin: s.durationMin })),
    weightTrend: trend.length ? { first: trend[0], last: trend[trend.length - 1], points: trend.length } : null,
    nutritionNotes,
    openAssignments,
    upcomingWeek: week,
    confirmedSocial: social.filter((p) => p.status === 'confirmed').map((p) => ({ what: p.what, when: p.when })),
  };
}
