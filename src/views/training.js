// Training view (§3.1). Rolling load, this week's plan with completion, missed
// sessions flagged, and recent history.

import { el, card, statTile, bars, fmtMins, fmtHours, fmtDay } from '../ui/dom.js';
import { datedSessions, withCompletion, computeLoad, missedSessions } from '../features/training.js';
import { today } from '../util/dates.js';

const STATUS_PILL = { done: 'done', planned: 'planned', missed: 'missed', rest: 'rest' };

export function render(app) {
  const s = app.state;
  const now = app.now;
  const root = el('div', { class: 'fade-in' });
  root.appendChild(el('div', { class: 'view-title' }, 'Training'));
  root.appendChild(el('div', { class: 'view-sub' }, 'Mountain bike + strength'));

  const load = computeLoad(s.activities, now);
  root.appendChild(el('div', { class: 'grid-2' }, [statTile('7-day load', fmtHours(load.sevenDay)), statTile('28-day load', fmtHours(load.twentyEightDay))]));

  root.appendChild(el('div', { class: 'section-label' }, '28-day load'));
  root.appendChild(card([bars(load.series.map((d) => ({ value: d.minutes }))), el('div', { class: 'row-sub', style: { marginTop: '8px' } }, 'Daily activity minutes')]));

  // Missed sessions (§3.1 — flag, don't auto-stack)
  const missed = missedSessions(s.plan, s.activities, now, 14);
  if (missed.length) {
    root.appendChild(el('div', { class: 'section-label' }, 'Missed — reschedule in chat'));
    const c = el('div', { class: 'card' });
    for (const m of missed) c.appendChild(el('div', { class: 'row-item' }, el('div', {}, el('div', { class: 'row-main' }, `${m.type} · ${m.intensity}`), el('div', { class: 'row-sub' }, fmtDay(m.date))), el('span', { class: 'pill missed' }, 'missed')));
    root.appendChild(c);
  }

  // This week's plan
  root.appendChild(el('div', { class: 'section-label' }, 'This week'));
  const wk = withCompletion(datedSessions(s.plan, weekStartOffset(now), weekStartOffset(now) + 6, now), s.activities, now);
  const c = el('div', { class: 'card' });
  for (const x of wk) {
    const right = x.type === 'rest' ? el('span', { class: 'pill rest' }, 'rest') : el('span', { class: `pill ${STATUS_PILL[x.status] || 'planned'}` }, x.status);
    c.appendChild(
      el('div', { class: 'row-item' }, el('div', {}, el('div', { class: 'row-main' }, `${x.day} · ${x.type === 'rest' ? 'Rest' : cap(x.type)}`), el('div', { class: 'row-sub' }, x.type === 'rest' ? x.note : `${fmtMins(x.durationMin)} · ${x.intensity}${x.note ? ' · ' + x.note : ''}`), x.status === 'done' && x.note ? el('div', { class: 'row-sub teal' }, x.note) : null), right)
    );
  }
  root.appendChild(c);

  return root;
}

function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function weekStartOffset(now) {
  const dow = new Date(today(now)).getDay();
  return -((dow + 6) % 7);
}
