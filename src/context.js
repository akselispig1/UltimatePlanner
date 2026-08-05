// Compact chat context snapshot for the calendar scheduler. Sends a small JSON
// summary of what the assistant needs to schedule: the weekly training plan,
// open assignments with due dates, the upcoming week's fixed commitments, and
// what's already queued. Pure module (state is passed in).

import { fixedCommitments, toHHMM } from './features/schedule.js';
import { offsetToIso, isoDate, today } from './util/dates.js';
import { pendingCount } from './features/calendar-queue.js';

export function buildSnapshot(state) {
  const { now, plan, assignments, externalCal, studyBlocks, queue } = state;
  const todayIso = isoDate(today(now));

  const openAssignments = assignments
    .filter((a) => a.status === 'open' && a.due >= todayIso)
    .sort((a, b) => (a.due < b.due ? -1 : 1))
    .slice(0, 10)
    .map((a) => ({ title: a.title, course: a.course, due: a.due, weight: a.weight }));

  const week = [];
  for (let off = 0; off <= 6; off++) {
    const date = offsetToIso(off, now);
    const commitments = fixedCommitments(date, { plan, externalCal }).map((c) => `${c.kind} ${toHHMM(c.start)}-${toHHMM(c.end)}`);
    week.push({ date, commitments });
  }

  return {
    today: todayIso,
    trainingPlan: (plan.sessions || []).map((s) => ({ day: s.day, type: s.type, durationMin: s.durationMin, intensity: s.intensity })),
    openAssignments,
    upcomingWeek: week,
    scheduledStudyBlocks: (studyBlocks || []).map((b) => ({ title: b.title, date: b.date, start: b.start })),
    pendingCalendarChanges: pendingCount(queue),
  };
}
