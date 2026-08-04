// Nutrition (§3.5). The hard rules live in the system prompt (config.js) and
// CLAUDE.md. This module only provides the two non-model behaviours: a weight
// trend line (a number and a trend, nothing more) and a gentle safety prompt if
// input suggests restriction. No calorie targets, no goal weight, no ranking.
// Pure module.

import { offsetToIso } from '../util/dates.js';
import { datedSessions } from './training.js';
import { recentSleep, isPoor } from './recovery.js';

function fmtDur(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ' ' + m + 'm' : ''}` : `${m}m`;
}

// "What should I eat today?", answered from the real day — today's session,
// tomorrow's session and last night's sleep (§3.5). Adequacy + performance only:
// never calories, macros, a goal weight, or good/bad food. Pure — safe in Node.
export function dailyFuelling({ plan = { sessions: [] }, sleep = [], now = new Date() } = {}) {
  const today = datedSessions(plan, 0, 0, now)[0];
  const tomorrow = datedSessions(plan, 1, 1, now)[0];
  const night = recentSleep(sleep, 1, now)[0];
  const poor = isPoor(night);

  const isHard = (s) => s && ['threshold', 'hard', 'race', 'tempo'].includes(s.intensity);
  const isBigRide = (s) => s && s.type === 'ride' && s.durationMin >= 90;

  let title;
  let detail;
  if (!today || today.type === 'rest') {
    title = 'Rest day — eat normally';
    detail = 'Still fuel to recover and grow: three solid meals with a protein source at each, plenty of fruit and veg. No need to eat less on an easy day.';
  } else if (isBigRide(today)) {
    title = `Big ride today (${fmtDur(today.durationMin)})`;
    detail = 'Front-load carbs at breakfast — porridge, banana, toast — and pack a snack for the ride (a bar, sandwich or dried fruit). Have a proper meal within an hour of getting back.';
  } else if (isHard(today)) {
    title = `Quality session today (${today.intensity})`;
    detail = 'A carb-based meal 2–3 hours before, kept light close to the effort. Make sure lunch and dinner have a protein source so you recover for the next one.';
  } else if (today.type === 'gym') {
    title = 'Strength day';
    detail = 'Protein at each meal helps it stick — eggs, dairy, chicken, beans, tofu. Normal carbs, and a snack beforehand if you train after school.';
  } else {
    title = `Easy ${today.type} today`;
    detail = 'Balanced plates: protein, carbs and veg. A pre-ride snack if you head out after school.';
  }
  if (poor) detail += " You slept poorly, so don't skip breakfast today — an easy win when you're tired.";

  let tomorrowCue = null;
  if (tomorrow && tomorrow.type !== 'rest' && (isBigRide(tomorrow) || isHard(tomorrow))) {
    tomorrowCue = `Tomorrow is ${isBigRide(tomorrow) ? `a ${fmtDur(tomorrow.durationMin)} ride` : `a ${tomorrow.intensity} session`} — a proper dinner tonight and a decent breakfast will set it up.`;
  }
  return { title, detail, tomorrowCue };
}

// 30-day weight trend from weight log entries. Returns points only — no goal,
// no target, no deficit.
export function weightTrend(logEntries, now = new Date(), days = 30) {
  const cutoff = offsetToIso(-days, now);
  return logEntries
    .filter((e) => e.kind === 'weight' && typeof e.value === 'number')
    .map((e) => ({ date: e.at.slice(0, 10), kg: e.value }))
    .filter((p) => p.date >= cutoff)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Terms a fuelling plan must never contain (§3.5). The tool sanitises against
// these so even a misbehaving model can't produce a restrictive/diet plan.
export const FORBIDDEN_FUELLING = [
  'calorie', 'kcal', 'deficit', 'macro', 'goal weight', 'target weight', 'weigh less',
  'lose weight', 'cheat meal', 'earned', 'burn off', 'burned off', 'good food', 'bad food',
];

function violates(text) {
  const t = String(text || '').toLowerCase();
  return FORBIDDEN_FUELLING.some((w) => t.includes(w));
}

// A safe default fuelling plan (adequacy + performance framing only). Used when
// the chat tool isn't handed explicit content.
export function buildDefaultFuelling() {
  return {
    principles: [
      'Start big ride days with extra carbs — porridge, banana, toast.',
      'Protein at every meal to rebuild after sessions.',
      'Keep a recovery snack within an hour of hard training.',
      'Never skip breakfast on a school-plus-training day.',
    ],
    days: [
      { when: 'Big ride / long trail days', guidance: 'Extra carbs before and during — add fruit, a bar, or a sandwich. Refuel within the hour after.' },
      { when: 'Gym or short days', guidance: 'Balanced plate: protein, carbs and veg in normal portions.' },
      { when: 'Rest days', guidance: 'Eat normally — rest days still need fuel to recover and grow.' },
    ],
  };
}

// Strip anything that breaks the nutrition rules from a fuelling plan. Returns
// the cleaned plan plus a list of what was removed.
export function sanitizeFuelling(plan) {
  const removed = [];
  const principles = (plan.principles || []).filter((p) => (violates(p) ? (removed.push(p), false) : true));
  const days = (plan.days || []).filter((d) => (violates(d.when) || violates(d.guidance) ? (removed.push(d.when || d.guidance), false) : true));
  const summary = violates(plan.summary) ? '' : plan.summary || '';
  return { plan: { ...plan, principles, days, summary }, removed };
}

const RESTRICTION_HINTS = [
  'skip', 'skipped', 'not eating', "didn't eat", 'did not eat', 'starv', 'skipping meals',
  'lose weight', 'losing weight', 'too fat', 'on a diet', 'cutting', 'restrict', 'nothing to eat all day',
];

// Returns a gentle prompt (string) if the text suggests skipped meals or
// restriction, else null. Never a plan adjustment (§3.5).
export function restrictionCheck(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (RESTRICTION_HINTS.some((h) => t.includes(h))) {
    return "It sounds like eating's been tricky lately. That's worth a chat with a parent or your coach — they can help more than a plan tweak can. Want me to just log how you're feeling?";
  }
  return null;
}
