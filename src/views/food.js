// Food & Fuelling — the one dedicated page (§3.5). Food advice doesn't belong on
// a calendar, so it lives here: recent meal advice logged from chat, the goal-
// linked fuelling plan, and a 30-day weight trend (a number and a trend, nothing
// more — no calories, no goal weight).

import { el, card, sparkline, fmtDay } from '../ui/dom.js';
import { weightTrend } from '../features/nutrition.js';

export function render(app) {
  const s = app.state;
  const now = app.now;
  const root = el('div', { class: 'fade-in' });
  root.appendChild(el('div', { class: 'view-title' }, 'Food & fuelling'));
  root.appendChild(el('div', { class: 'view-sub' }, 'Send meal or scale photos in chat — the advice lands here.'));

  // Recent meal advice / notes, newest first (logged by the chatbot).
  const notes = (s.logs || []).filter((e) => e.kind === 'nutrition').sort((a, b) => (a.at < b.at ? 1 : -1));
  root.appendChild(el('div', { class: 'section-label' }, 'Recent meals & advice'));
  const nc = el('div', { class: 'card' });
  if (!notes.length) nc.appendChild(el('div', { class: 'empty' }, 'Send a meal photo in chat and the advice shows up here.'));
  for (const n of notes.slice(0, 10)) {
    nc.appendChild(el('div', { class: 'row-item' }, el('div', { style: { flex: 1 } }, el('div', { class: 'row-main', style: { fontSize: '14px' } }, n.text || ''), el('div', { class: 'row-sub' }, fmtDay(n.at.slice(0, 10))))));
  }
  root.appendChild(nc);

  // Fuelling plan(s).
  root.appendChild(el('div', { class: 'section-label' }, 'Fuelling plan'));
  const plans = s.fuellingPlans || [];
  if (!plans.length) root.appendChild(card(el('div', { class: 'empty' }, 'Ask the chatbot: "make me a fuelling plan".')));
  for (const fuel of plans) {
    const goal = (s.goals || []).find((g) => g.id === fuel.goalId);
    const fc = el('div', { class: 'card' });
    fc.appendChild(el('div', { class: 'row-main' }, fuel.title));
    fc.appendChild(el('div', { class: 'row-sub' }, fuel.summary));
    if (goal) fc.appendChild(el('div', { class: 'row-sub accent', style: { marginBottom: '4px' } }, `→ ${goal.title}`));
    for (const pr of fuel.principles || []) fc.appendChild(el('div', { class: 'row-sub', style: { paddingLeft: '2px' } }, `• ${pr}`));
    for (const d of fuel.days || []) fc.appendChild(el('div', { class: 'row-item' }, el('div', { style: { flex: 1 } }, el('div', { class: 'row-main', style: { fontSize: '14px' } }, d.when), el('div', { class: 'row-sub' }, d.guidance))));
    root.appendChild(fc);
  }

  // Weight — 30-day trend (§3.5: a number and a trend line, nothing more).
  const trend = weightTrend(s.logs, now);
  root.appendChild(el('div', { class: 'section-label' }, 'Weight — 30-day trend'));
  root.appendChild(
    card(
      trend.length
        ? [sparkline(trend.map((p) => p.kg)), el('div', { class: 'card-row', style: { marginTop: '8px' } }, el('span', { class: 'row-sub' }, fmtDay(trend[0].date)), el('span', { class: 'row-main' }, `${trend[trend.length - 1].kg} kg`), el('span', { class: 'row-sub' }, fmtDay(trend[trend.length - 1].date)))]
        : el('div', { class: 'empty' }, 'Send a scale photo in chat to log weight.')
    )
  );

  return root;
}
