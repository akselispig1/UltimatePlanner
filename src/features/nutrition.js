// Nutrition (§3.5). The hard rules live in the system prompt (config.js) and
// CLAUDE.md. This module only provides the two non-model behaviours: a weight
// trend line (a number and a trend, nothing more) and a gentle safety prompt if
// input suggests restriction. No calorie targets, no goal weight, no ranking.
// Pure module.

import { offsetToIso } from '../util/dates.js';

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
