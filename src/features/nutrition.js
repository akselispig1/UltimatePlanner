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
