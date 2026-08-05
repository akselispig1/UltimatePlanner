// Compact chat context snapshot for the calendar scheduler. Sends the saved
// weekly training plan, today's date, and how much is already queued — enough
// for the bot to schedule sensibly. Pure module (state is passed in).

import { isoDate, today } from './util/dates.js';
import { pendingCount } from './features/calendar-queue.js';

export function buildSnapshot(state) {
  const { now, plan, queue } = state;
  return {
    today: isoDate(today(now)),
    trainingPlan: (plan.sessions || []).map((s) => ({ day: s.day, type: s.type, durationMin: s.durationMin, intensity: s.intensity })),
    pendingCalendarChanges: pendingCount(queue),
  };
}
