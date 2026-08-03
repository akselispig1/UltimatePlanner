// Recovery (§3.4): sleep duration, score and resting HR. If sleep is poor two
// nights running, SUGGEST downgrading the next hard session — never silently
// rewrite the plan. Pure module.

import { offsetToIso, isoDate, today } from '../util/dates.js';
import { datedSessions } from './training.js';
import { INTENSITY } from '../config.js';

const POOR_SCORE = 50;

export function isPoor(night) {
  return night && (night.score < POOR_SCORE || night.durationMin < 360);
}

export function recentSleep(sleep, nights = 7, now = new Date()) {
  const wanted = [];
  for (let off = -nights; off <= -1; off++) wanted.push(offsetToIso(off, now));
  return wanted.map((date) => sleep.find((s) => s.date === date) || null).filter(Boolean);
}

export function poorTwoNightsRunning(sleep, now = new Date()) {
  const last2 = recentSleep(sleep, 2, now);
  return last2.length === 2 && last2.every(isPoor);
}

// The next hard session in the upcoming week, if any.
export function nextHardSession(plan, now = new Date()) {
  const upcoming = datedSessions(plan, 0, 6, now);
  return upcoming.find((s) => (INTENSITY[s.intensity] || 0) >= INTENSITY.threshold) || null;
}

// A downgrade suggestion (not applied). Returns null when nothing to suggest.
export function recoverySuggestion({ plan, sleep, now = new Date() } = {}) {
  if (!poorTwoNightsRunning(sleep, now)) return null;
  const session = nextHardSession(plan, now);
  if (!session) return null;
  return {
    suggest: true,
    session,
    message: `Two rough nights in a row. Consider easing ${session.day}'s ${session.type} (${session.intensity}) to endurance — your call, I won't change it automatically.`,
  };
}

export function sleepSummary(sleep, now = new Date()) {
  const last7 = recentSleep(sleep, 7, now);
  if (!last7.length) return { avgScore: null, avgDurationMin: null, lastNight: null };
  const avgScore = Math.round(last7.reduce((a, s) => a + s.score, 0) / last7.length);
  const avgDurationMin = Math.round(last7.reduce((a, s) => a + s.durationMin, 0) / last7.length);
  const lastNight = last7[last7.length - 1];
  return { avgScore, avgDurationMin, lastNight, series: last7 };
}
