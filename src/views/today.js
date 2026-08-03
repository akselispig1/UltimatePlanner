// Today — the dashboard. Daily completion ring, load, sleep, weight, tomorrow's
// Balancer summary, dues, and any recovery suggestion.

import { el, card, ring, statTile, fmtMins, fmtHours, fmtDay } from '../ui/dom.js';
import { datedSessions, withCompletion, computeLoad } from '../features/training.js';
import { sleepSummary, recoverySuggestion } from '../features/recovery.js';
import { weightTrend } from '../features/nutrition.js';
import { composeTomorrow } from '../features/balancer.js';
import { pendingCount } from '../features/calendar-queue.js';
import { withProgress } from '../features/goals.js';
import { isoDate, today } from '../util/dates.js';

export function render(app) {
  const s = app.state;
  const now = app.now;
  const root = el('div', { class: 'fade-in' });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  root.appendChild(el('div', { class: 'view-title' }, greeting));
  root.appendChild(el('div', { class: 'view-sub' }, new Date(now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })));

  // Recovery suggestion (§3.4) — suggest, never rewrite.
  const rec = recoverySuggestion({ plan: s.plan, sleep: s.sleep, now });
  if (rec) root.appendChild(el('div', { class: 'banner warn' }, rec.message));

  // Weekly training completion ring.
  const week = withCompletion(datedSessions(s.plan, weekStartOffset(now), 0, now), s.activities, now);
  const planned = week.filter((x) => x.type !== 'rest');
  const doneCount = planned.filter((x) => x.status === 'done').length;
  const pct = planned.length ? Math.round((doneCount / planned.length) * 100) : 0;

  const load = computeLoad(s.activities, now);
  const sleepS = sleepSummary(s.sleep, now);
  const trend = weightTrend(s.logs, now);
  const lastWeight = trend.length ? trend[trend.length - 1].kg : null;

  root.appendChild(
    card(
      el('div', { class: 'ring-wrap' }, ring(pct, { value: `${pct}%`, label: 'Week' }), el('div', {}, el('div', { class: 'stat-label' }, 'Sessions done this week'), el('div', { class: 'stat-value sm' }, el('span', { class: 'accent' }, `${doneCount}`), el('span', { class: 'stat-unit' }, `/ ${planned.length}`)), el('div', { class: 'row-sub' }, `${fmtMins(load.sevenDay)} in the last 7 days`)))
    )
  );

  root.appendChild(
    el('div', { class: 'grid-2' }, [
      statTile('7-day load', fmtHours(load.sevenDay), '', 'accent'),
      statTile('Sleep score', sleepS.avgScore ?? '—', 'avg', 'teal'),
      statTile('Last weight', lastWeight ?? '—', lastWeight ? 'kg' : '', 'text'),
      statTile('28-day load', fmtHours(load.twentyEightDay), '', 'accent'),
    ])
  );

  // Tomorrow (Balancer §3.7)
  const plan = composeTomorrow({ plan: s.plan, externalCal: s.externalCal, social: s.social, assignments: s.assignments, existingBlocks: s.studyBlocks, now });
  root.appendChild(el('div', { class: 'section-label' }, 'Tomorrow'));
  root.appendChild(card(el('div', { class: 'row-main' }, plan.summary)));

  // Upcoming dues (§3.2)
  const todayIso = isoDate(today(now));
  const dues = s.assignments.filter((a) => a.status === 'open' && a.due >= todayIso).sort((a, b) => (a.due < b.due ? -1 : 1)).slice(0, 3);
  if (dues.length) {
    root.appendChild(el('div', { class: 'section-label' }, 'Due soon'));
    const c = el('div', { class: 'card' });
    for (const a of dues) {
      c.appendChild(el('div', { class: 'row-item' }, el('div', {}, el('div', { class: 'row-main' }, a.title), el('div', { class: 'row-sub' }, a.course)), el('span', { class: 'pill missed' }, `DUE ${fmtDay(a.due)}`)));
    }
    root.appendChild(c);
  }

  // Pending calendar sync (§1.5)
  const pending = pendingCount(s.queue);
  if (pending) root.appendChild(el('div', { class: 'banner info' }, `${pending} calendar change${pending > 1 ? 's' : ''} queued — syncing on the next run.`));

  return root;
}

function weekStartOffset(now) {
  // Offset (negative) from today back to Monday of this week.
  const dow = new Date(today(now)).getDay(); // 0=Sun
  const sinceMon = (dow + 6) % 7;
  return -sinceMon;
}
