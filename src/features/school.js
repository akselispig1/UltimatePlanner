// School: study-block generation (§3.2). Work backwards from the due date, size
// the block by assignment weight, and place it in free calendar time — never
// overlapping fixed commitments (school, training, confirmed social, trips).
// Pure module.

import { today, offsetToIso, daysBetween, isoDate } from '../util/dates.js';
import { fixedCommitments, freeWindows, placeBlock, parseIsoLocal, toHHMM } from './schedule.js';
import { uuid } from '../util/id.js';

const STUDY_WIN_START = 16 * 60; // 16:00, after school + training
const STUDY_WIN_END = 21 * 60 + 30; // 21:30

// Minutes of study a piece of work warrants, from its weight. Rounded to 15.
export function sizeFor(weight) {
  const raw = Math.max(30, Math.min(180, Math.round((weight || 5) * 6)));
  return Math.round(raw / 15) * 15;
}

// ctx: { assignments, plan, externalCal, social, existingBlocks, now }
export function generateStudyBlocks(ctx = {}) {
  const { assignments = [], plan = { sessions: [] }, externalCal = [], social = [], existingBlocks = [], now = new Date() } = ctx;
  const placed = [...existingBlocks]; // treat existing blocks as busy too
  const created = [];

  const open = assignments
    .filter((a) => a.status === 'open')
    .filter((a) => daysBetween(today(now), parseIsoLocal(a.due)) >= 0)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : b.weight - a.weight));

  for (const asg of open) {
    const total = sizeFor(asg.weight);
    const blockLen = Math.min(90, total);
    const count = Math.max(1, Math.ceil(total / blockLen));
    const dueOffset = daysBetween(today(now), parseIsoLocal(asg.due));

    let done = 0;
    // Candidate days: today through the day before the due date (inclusive).
    for (let off = 0; off <= Math.max(0, dueOffset - 1) && done < count; off++) {
      const date = offsetToIso(off, now);
      const busy = [
        ...fixedCommitments(date, { plan, externalCal, social }),
        ...placed.filter((b) => b.date === date).map((b) => intervalOf(b)),
      ];
      const free = freeWindows(STUDY_WIN_START, STUDY_WIN_END, busy);
      const slot = placeBlock(blockLen, free);
      if (!slot) continue;
      const block = {
        id: `sb-${uuid()}`,
        assignmentId: asg.id,
        title: `Study: ${asg.title}`,
        course: asg.course,
        date,
        start: toHHMM(slot.start),
        durationMin: blockLen,
      };
      placed.push(block);
      created.push(block);
      done++;
    }
  }
  return created;
}

function intervalOf(block) {
  const [h, m] = block.start.split(':').map(Number);
  const start = h * 60 + m;
  return { start, end: start + block.durationMin, kind: 'study' };
}

// Schedule ONE study block of a given duration against a specific assignment,
// in the next free evening slot. Used by the create_study_block chat tool.
export function scheduleOne({ title, assignmentId = null, course = null, durationMin = 60, plan = { sessions: [] }, externalCal = [], social = [], existingBlocks = [], now = new Date() }) {
  const placed = [...existingBlocks];
  for (let off = 1; off <= 14; off++) {
    const date = offsetToIso(off, now);
    const busy = [...fixedCommitments(date, { plan, externalCal, social }), ...placed.filter((b) => b.date === date).map(intervalOf)];
    const free = freeWindows(STUDY_WIN_START, STUDY_WIN_END, busy);
    const slot = placeBlock(durationMin, free);
    if (slot) {
      return { id: `sb-${uuid()}`, assignmentId, title: `Study: ${title}`, course, date, start: toHHMM(slot.start), durationMin };
    }
  }
  return null;
}

// A DUE all-day event descriptor for the calendar (§3.2).
export function dueEventFor(asg) {
  return { title: `DUE: ${asg.title}`, date: asg.due, allDay: true, kind: 'due' };
}

// A trip becomes an all-day calendar event as soon as it appears (§3.2).
export function tripEventFor(trip) {
  return { title: trip.title, date: trip.date, endDate: trip.endDate, allDay: true, kind: 'trip' };
}

export { isoDate };
