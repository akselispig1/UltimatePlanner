// School view (§3.2). Assignments with due dates, generated study blocks, and
// trips. "Generate study blocks" places work in free time and queues it.

import { el, card, fmtDay } from '../ui/dom.js';
import { generateStudyBlocks } from '../features/school.js';
import { enqueue } from '../features/calendar-queue.js';
import { dueEventFor } from '../features/school.js';
import { store } from '../storage.js';
import { DATA_FILES } from '../config.js';
import { isoDate, today } from '../util/dates.js';

export function render(app) {
  const s = app.state;
  const now = app.now;
  const root = el('div', { class: 'fade-in' });
  root.appendChild(el('div', { class: 'view-title' }, 'School'));
  root.appendChild(el('div', { class: 'view-sub' }, 'Assignments, study blocks, trips'));

  // Trips (§3.2)
  if (s.externalCal.length) {
    root.appendChild(el('div', { class: 'section-label' }, 'Trips'));
    const c = el('div', { class: 'card' });
    for (const t of s.externalCal) c.appendChild(el('div', { class: 'row-item' }, el('div', { class: 'row-main' }, t.title), el('span', { class: 'pill planned' }, fmtDay(t.date))));
    root.appendChild(c);
  }

  // Assignments
  const todayIso = isoDate(today(now));
  const open = s.assignments.filter((a) => a.status === 'open' && a.due >= todayIso).sort((a, b) => (a.due < b.due ? -1 : 1));
  root.appendChild(el('div', { class: 'card-row', style: { margin: '20px 2px 10px' } }, el('div', { class: 'section-label', style: { margin: 0 } }, `Assignments (${open.length})`), el('button', { class: 'btn btn-accent btn-sm', onClick: () => generate(app) }, 'Generate study blocks')));
  const ac = el('div', { class: 'card' });
  if (!open.length) ac.appendChild(el('div', { class: 'empty' }, 'Nothing open. Nice.'));
  for (const a of open) {
    ac.appendChild(el('div', { class: 'row-item' }, el('div', {}, el('div', { class: 'row-main' }, a.title), el('div', { class: 'row-sub' }, `${a.course} · weight ${a.weight}`)), el('span', { class: 'pill missed' }, `DUE ${fmtDay(a.due)}`)));
  }
  root.appendChild(ac);

  // Study blocks
  root.appendChild(el('div', { class: 'section-label' }, `Study blocks (${s.studyBlocks.length})`));
  const bc = el('div', { class: 'card' });
  if (!s.studyBlocks.length) bc.appendChild(el('div', { class: 'empty' }, 'No study blocks yet. Tap "Generate study blocks".'));
  for (const b of [...s.studyBlocks].sort((a, b2) => (a.date + a.start < b2.date + b2.start ? -1 : 1))) {
    bc.appendChild(el('div', { class: 'row-item' }, el('div', {}, el('div', { class: 'row-main' }, b.title.replace('Study: ', '')), el('div', { class: 'row-sub' }, `${fmtDay(b.date)} · ${b.start} · ${b.durationMin}min`)), el('span', { class: 'pill planned' }, 'study')));
  }
  root.appendChild(bc);

  return root;
}

async function generate(app) {
  const s = app.state;
  const created = generateStudyBlocks({ assignments: s.assignments, plan: s.plan, externalCal: s.externalCal, social: s.social, existingBlocks: s.studyBlocks, now: app.now });
  if (!created.length) {
    app.toast && app.toast('No free slots found for new study blocks.');
    return;
  }
  const data = await store.read(DATA_FILES.studyBlocks);
  data.blocks.push(...created);
  await store.write(DATA_FILES.studyBlocks, data);
  // Queue each block + any DUE events to the calendar.
  for (const b of created) await enqueue(store, { action: 'create', event: { title: b.title, date: b.date, start: b.start, durationMin: b.durationMin, kind: 'study' } });
  const todayIso = isoDate(today(app.now));
  for (const a of s.assignments.filter((x) => x.status === 'open' && x.due >= todayIso)) await enqueue(store, { action: 'create', event: dueEventFor(a) });
  await app.refresh();
}
