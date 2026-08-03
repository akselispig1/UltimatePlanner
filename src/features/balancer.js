// The Balancer (§3.7). Nightly job that composes tomorrow: fixed commitments
// (school, confirmed social) → training slot → study blocks in remaining gaps →
// calendar intents + a morning summary. Conflict rule when time is short:
// school deadlines > confirmed social > training > optional study.
// Pure module — produces intents; the queue/adapter do the writing.

import { offsetToIso, daysBetween, today } from '../util/dates.js';
import { fixedCommitments, freeWindows, toHHMM, toMin, parseIsoLocal } from './schedule.js';
import { generateStudyBlocks } from './school.js';
import { dueEventFor } from './school.js';

const DAY_WIN_START = toMin('06:00');
const DAY_WIN_END = toMin('22:00');

export function composeTomorrow(ctx = {}) {
  const { plan = { sessions: [] }, externalCal = [], social = [], assignments = [], existingBlocks = [], now = new Date() } = ctx;
  const date = offsetToIso(1, now);

  const fixed = fixedCommitments(date, { plan, externalCal, social });
  const free = freeWindows(DAY_WIN_START, DAY_WIN_END, fixed);

  const events = [];
  const dropped = [];

  // Training: the session is already part of fixed commitments; surface it as a
  // calendar intent (unless it's a trip day that swallowed everything).
  const training = fixed.find((f) => f.kind === 'training');
  const isTripDay = fixed.some((f) => f.kind === 'trip');
  if (training && !isTripDay) {
    events.push({
      action: 'create',
      event: { title: training.label, date, start: toHHMM(training.start), durationMin: training.end - training.start, kind: 'training' },
    });
  }

  // Study blocks in remaining gaps (optional — dropped first when short).
  let studyBlocks = [];
  if (!isTripDay) {
    studyBlocks = generateStudyBlocks({ assignments, plan, externalCal, social, existingBlocks, now }).filter((b) => b.date === date);
    if (free.length === 0 && studyBlocks.length) {
      dropped.push(...studyBlocks.map((b) => b.title));
      studyBlocks = [];
    }
    for (const b of studyBlocks) {
      events.push({ action: 'create', event: { title: b.title, date, start: b.start, durationMin: b.durationMin, kind: 'study' } });
    }
  }

  // DUE all-day events for anything due tomorrow.
  const dueTomorrow = assignments.filter((a) => a.due === date && a.status === 'open');
  for (const a of dueTomorrow) events.push({ action: 'create', event: dueEventFor(a) });

  return { date, events, summary: summarize({ date, fixed, training, studyBlocks, dueTomorrow, isTripDay }), dropped };
}

function summarize({ fixed, training, studyBlocks, dueTomorrow, isTripDay }) {
  if (isTripDay) {
    const trip = fixed.find((f) => f.kind === 'trip');
    return `Tomorrow: ${trip ? trip.label : 'Trip'} — all day. Rest and travel.`;
  }
  const parts = [];
  const school = fixed.find((f) => f.kind === 'school');
  if (school) parts.push(`School ${toHHMM(school.start)}–${toHHMM(school.end)}`);
  const social = fixed.filter((f) => f.kind === 'social');
  for (const s of social) parts.push(`${s.label} ${toHHMM(s.start)}`);
  if (training) parts.push(`${training.label} ${toHHMM(training.start)}`);
  for (const b of studyBlocks) parts.push(`${b.title.replace('Study: ', 'Study ')} ${b.start}`);
  let line = 'Tomorrow: ' + (parts.length ? parts.join(' · ') : 'nothing fixed — a free day');
  if (dueTomorrow.length) line += `. ${dueTomorrow.length} due.`;
  return line;
}
