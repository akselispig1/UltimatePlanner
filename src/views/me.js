// Me — goals, recovery, social review queue, and setup (keys + integration
// status). This screen replaces most settings (§3.6).

import { el, card, sparkline, fmtMins, fmtDay } from '../ui/dom.js';
import { withProgress } from '../features/goals.js';
import { sleepSummary } from '../features/recovery.js';
import { weightTrend } from '../features/nutrition.js';
import { enqueue } from '../features/calendar-queue.js';
import { store } from '../storage.js';
import { DATA_FILES, INTEGRATIONS } from '../config.js';
import { setKey, getAnthropicKey, getGithubKey, getDataRepo, connectionStatus, clearAllKeys } from '../keys.js';
import { adapterMode, ADAPTER_NAMES } from '../adapters/index.js';

export function render(app) {
  const s = app.state;
  const now = app.now;
  const root = el('div', { class: 'fade-in' });
  root.appendChild(el('div', { class: 'view-title' }, 'Me'));
  root.appendChild(el('div', { class: 'view-sub' }, '14 · mountain biker + student'));

  // ---- Goals (§3.6) ----
  root.appendChild(el('div', { class: 'section-label' }, 'Goals'));
  const active = withProgress(s.goals.filter((g) => g.status === 'active'), { activities: s.activities, assignments: s.assignments, now });
  const gc = el('div', { class: 'card' });
  if (!active.length) gc.appendChild(el('div', { class: 'empty' }, 'No goals yet. Ask in chat to set one.'));
  for (const g of active) {
    const p = g.progress;
    gc.appendChild(
      el('div', { class: 'row-item' }, el('div', { style: { flex: 1 } }, el('div', { class: 'row-main' }, g.title), el('div', { class: 'row-sub' }, `${g.type} · ${g.target}`), progressBar(p)), el('button', { class: 'btn btn-ghost btn-sm', onClick: () => retireGoal(app, g.id) }, 'Retire'))
    );
  }
  root.appendChild(gc);

  // ---- Recovery (§3.4) ----
  const sleepS = sleepSummary(s.sleep, now);
  root.appendChild(el('div', { class: 'section-label' }, 'Recovery'));
  root.appendChild(
    card([
      el('div', { class: 'grid-2' }, [
        tile('Avg sleep', sleepS.avgScore ?? '—', 'score'),
        tile('Avg duration', sleepS.avgDurationMin ? fmtMins(sleepS.avgDurationMin) : '—', ''),
      ]),
      sleepS.lastNight ? el('div', { class: 'row-sub', style: { marginTop: '10px' } }, `Last night: ${sleepS.lastNight.score} score · ${fmtMins(sleepS.lastNight.durationMin)} · RHR ${sleepS.lastNight.restingHr}`) : null,
    ])
  );

  // ---- Weight trend (§3.5 — a number and a trend, nothing more) ----
  const trend = weightTrend(s.logs, now);
  root.appendChild(el('div', { class: 'section-label' }, 'Weight — 30-day trend'));
  root.appendChild(
    card(
      trend.length
        ? [sparkline(trend.map((p) => p.kg)), el('div', { class: 'card-row', style: { marginTop: '8px' } }, el('span', { class: 'row-sub' }, fmtDay(trend[0].date)), el('span', { class: 'row-main' }, `${trend[trend.length - 1].kg} kg`), el('span', { class: 'row-sub' }, fmtDay(trend[trend.length - 1].date)))]
        : el('div', { class: 'empty' }, 'Send a scale photo in chat to log weight.')
    )
  );

  // ---- Social review queue (§3.3) ----
  const pendingPlans = s.social.filter((p) => p.status === 'pending');
  root.appendChild(el('div', { class: 'section-label' }, `Social — review (${pendingPlans.length})`));
  const sc = el('div', { class: 'card' });
  if (!pendingPlans.length) sc.appendChild(el('div', { class: 'empty' }, 'No plans awaiting review.'));
  for (const p of pendingPlans) {
    sc.appendChild(
      el('div', { class: 'row-item' }, el('div', { style: { flex: 1 } }, el('div', { class: 'row-main' }, p.what), el('div', { class: 'row-sub' }, `${p.who || '—'} · ${(p.when || '').replace('T', ' ')} · ${p.where || ''}`), el('div', { class: 'row-sub muted' }, `“${p.raw}”`)), el('div', { style: { display: 'flex', gap: '6px' } }, el('button', { class: 'btn btn-accent btn-sm', onClick: () => confirmPlan(app, p.id) }, 'Confirm'), el('button', { class: 'btn btn-ghost btn-sm', onClick: () => discardPlan(app, p.id) }, 'Discard')))
    );
  }
  root.appendChild(sc);

  // ---- Setup / keys (§1.4) ----
  root.appendChild(setupSection(app, s));

  return root;
}

function progressBar(p) {
  if (p.pct == null) return el('div', { class: 'row-sub muted' }, p.note || 'Tracked manually');
  const wrap = el('div', { style: { marginTop: '8px' } });
  const track = el('div', { style: { height: '8px', background: '#2c2c2e', borderRadius: '999px', overflow: 'hidden' } });
  track.appendChild(el('div', { style: { height: '100%', width: `${p.pct}%`, background: p.pct >= 100 ? 'var(--teal)' : 'var(--accent)' } }));
  wrap.appendChild(track);
  wrap.appendChild(el('div', { class: 'row-sub', style: { marginTop: '4px' } }, `${p.value}${p.unit ? ' ' + p.unit : ''} · ${p.pct}%`));
  return wrap;
}

function tile(label, value, unit) {
  return el('div', { class: 'card tight' }, el('div', { class: 'stat-label' }, label), el('div', { class: 'stat-value sm' }, el('span', { class: 'teal' }, String(value)), unit ? el('span', { class: 'stat-unit' }, unit) : null));
}

function setupSection(app, s) {
  const conn = connectionStatus();
  const wrap = el('div', {});
  wrap.appendChild(el('div', { class: 'section-label' }, 'Setup & connections'));

  // Per-integration status (§1.4, §5.2)
  const status = el('div', { class: 'card' });
  for (const name of INTEGRATIONS) {
    const on = name === 'anthropic' ? conn.anthropic : name === 'github' ? conn.github : (s.sync[name] && s.sync[name].connected);
    // github backs the data store, not an adapter; everything else has a mock/live adapter.
    const mode = ADAPTER_NAMES.includes(name) ? `${adapterMode(name)} adapter` : name === 'github' ? (conn.github ? 'live store' : 'local store') : '';
    const synced = s.sync[name] && s.sync[name].lastSync ? ' · synced ' + s.sync[name].lastSync : '';
    status.appendChild(
      el('div', { class: 'row-item' }, el('div', {}, el('div', { class: 'row-main' }, label(name)), el('div', { class: 'row-sub' }, `${mode}${synced}`)), el('span', {}, el('span', { class: `status-dot ${on ? 'on' : 'off'}` }), el('span', { class: 'row-sub', style: { marginLeft: '6px' } }, on ? 'connected' : 'not connected')))
    );
  }
  wrap.appendChild(status);

  // Key entry (§1.4). Values are never pre-filled or displayed.
  const box = el('div', { class: 'card' });
  box.appendChild(el('div', { class: 'banner info' }, 'The app runs fully on demo data with no keys. Add keys to go live — each flips its own adapter independently.'));
  box.appendChild(keyField('Anthropic API key', 'anthropic', 'sk-ant-…', getAnthropicKey(), 'Powers chat directly from your phone.'));
  box.appendChild(keyField('GitHub fine-grained PAT', 'github', 'github_pat_…', getGithubKey(), 'Scoped to life-balancer-data, Contents read+write.'));
  box.appendChild(keyField('Data repo (owner/name)', 'repo', 'you/life-balancer-data', getDataRepo(), 'Where your synced data lives.', 'text'));
  box.appendChild(el('button', { class: 'btn btn-accent', style: { marginTop: '8px', width: '100%' }, onClick: () => saveKeys(app, box) }, 'Save keys'));
  wrap.appendChild(box);

  wrap.appendChild(el('button', { class: 'btn btn-danger', style: { width: '100%' }, onClick: () => clearAll(app) }, 'Clear all keys & sign out'));
  return wrap;
}

function keyField(labelText, which, placeholder, current, help, type = 'password') {
  const f = el('div', { class: 'field' });
  f.appendChild(el('label', {}, labelText + (current ? '  ·  set' : '')));
  f.appendChild(el('input', { type, placeholder: current ? '•••••• (leave blank to keep)' : placeholder, dataset: { which }, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' }));
  f.appendChild(el('div', { class: 'help' }, help));
  return f;
}

async function saveKeys(app, box) {
  for (const input of box.querySelectorAll('input[data-which]')) {
    const v = input.value.trim();
    if (v) setKey(input.dataset.which, v);
  }
  await app.refresh();
  app.toast && app.toast('Saved. Adapters updated.');
}

async function clearAll(app) {
  clearAllKeys();
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) await r.unregister();
  }
  await app.refresh();
  app.toast && app.toast('Keys cleared. Back to demo mode.');
}

async function retireGoal(app, id) {
  const data = await store.read(DATA_FILES.goals);
  const g = data.goals.find((x) => x.id === id);
  if (g) g.status = 'retired';
  await store.write(DATA_FILES.goals, data);
  await app.refresh();
}

async function confirmPlan(app, id) {
  const data = await store.read(DATA_FILES.socialQueue);
  const p = data.plans.find((x) => x.id === id);
  if (p) {
    p.status = 'confirmed';
    await store.write(DATA_FILES.socialQueue, data);
    // Confirmed plans become fixed calendar blocks (§3.3).
    await enqueue(store, { action: 'create', event: { title: p.what, date: (p.when || '').slice(0, 10), start: (p.when || '').slice(11, 16) || '18:00', durationMin: 120, kind: 'social' } });
  }
  await app.refresh();
}

async function discardPlan(app, id) {
  const data = await store.read(DATA_FILES.socialQueue);
  const p = data.plans.find((x) => x.id === id);
  if (p) p.status = 'discarded';
  await store.write(DATA_FILES.socialQueue, data);
  await app.refresh();
}

function label(name) {
  return { anthropic: 'Anthropic (chat)', github: 'GitHub data repo', calendar: 'Google Calendar', strava: 'Strava', health: 'Apple Health / Garmin', schoology: 'Schoology' }[name] || name;
}
