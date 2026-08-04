// Food & Fuelling — the one dedicated page (§3.5). Food advice doesn't belong on
// a calendar, so it lives here: recent meal advice logged from chat, the goal-
// linked fuelling plan, and a 30-day weight trend (a number and a trend, nothing
// more — no calories, no goal weight).

import { el, card, sparkline, fmtDay } from '../ui/dom.js';
import { weightTrend, dailyFuelling } from '../features/nutrition.js';

export function render(app) {
  const s = app.state;
  const now = app.now;
  const root = el('div', { class: 'fade-in' });
  root.appendChild(el('div', { class: 'view-title' }, 'Food & fuelling'));
  root.appendChild(el('div', { class: 'view-sub' }, 'What today needs, plus advice from the photos you send in chat.'));

  // Today's fuelling — the answer to "what should I eat today?", from your real
  // training + last night's sleep. Updates on its own each day (§3.5).
  const fuel = dailyFuelling({ plan: s.plan, sleep: s.sleep, now });
  const todayCard = el('div', { class: 'card fuel-today' });
  todayCard.appendChild(el('div', { class: 'stat-label' }, "Today's fuelling"));
  todayCard.appendChild(el('div', { class: 'row-main', style: { fontSize: '17px', margin: '4px 0 6px' } }, fuel.title));
  todayCard.appendChild(el('div', {}, fuel.detail));
  if (fuel.tomorrowCue) todayCard.appendChild(el('div', { class: 'row-sub accent', style: { marginTop: '8px' } }, fuel.tomorrowCue));
  root.appendChild(todayCard);

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
