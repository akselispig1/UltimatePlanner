// Settings modal (§1.4). The only non-chat surface: enter keys, see per-
// integration connection status, and clear everything. Opened from the gear in
// the chat header.

import { el } from '../ui/dom.js';
import { INTEGRATIONS } from '../config.js';
import { setKey, getAnthropicKey, getGithubKey, getDataRepo, connectionStatus, clearAllKeys } from '../keys.js';
import { adapterMode, ADAPTER_NAMES } from '../adapters/index.js';

export function openSettings(app) {
  const overlay = el('div', { class: 'modal-overlay', onClick: (e) => { if (e.target === overlay) close(); } });
  const close = () => overlay.remove();

  const sheet = el('div', { class: 'modal-sheet' });
  sheet.appendChild(el('div', { class: 'modal-head' }, el('div', { class: 'modal-title' }, 'Setup & connections'), el('button', { class: 'btn btn-ghost btn-sm', onClick: close }, 'Done')));

  const body = el('div', { class: 'modal-body' });
  const s = app.state || { sync: {} };
  const conn = connectionStatus();

  body.appendChild(el('div', { class: 'banner info' }, 'The app runs fully on demo data with no keys. Add keys to go live — each flips its own adapter independently. Your plans and schedule show up in Google Calendar.'));

  // Per-integration status.
  const status = el('div', { class: 'card' });
  for (const name of INTEGRATIONS) {
    const on = name === 'anthropic' ? conn.anthropic : name === 'github' ? conn.github : (s.sync[name] && s.sync[name].connected);
    const mode = ADAPTER_NAMES.includes(name) ? `${adapterMode(name)} adapter` : name === 'github' ? (conn.github ? 'live store' : 'local store') : '';
    const synced = s.sync[name] && s.sync[name].lastSync ? ' · synced ' + s.sync[name].lastSync : '';
    status.appendChild(el('div', { class: 'row-item' }, el('div', {}, el('div', { class: 'row-main' }, label(name)), el('div', { class: 'row-sub' }, `${mode}${synced}`)), el('span', {}, el('span', { class: `status-dot ${on ? 'on' : 'off'}` }), el('span', { class: 'row-sub', style: { marginLeft: '6px' } }, on ? 'connected' : 'not connected'))));
  }
  body.appendChild(status);

  // Key entry — never pre-filled or displayed.
  const box = el('div', { class: 'card' });
  box.appendChild(keyField('Anthropic API key', 'anthropic', 'sk-ant-…', getAnthropicKey(), 'Powers chat directly from your phone.'));
  box.appendChild(keyField('GitHub fine-grained PAT', 'github', 'github_pat_…', getGithubKey(), 'Scoped to life-balancer-data, Contents read+write.'));
  box.appendChild(keyField('Data repo (owner/name)', 'repo', 'you/life-balancer-data', getDataRepo(), 'Where your synced data lives.', 'text'));
  box.appendChild(el('button', { class: 'btn btn-accent', style: { marginTop: '8px', width: '100%' }, onClick: () => saveKeys(app, box, close) }, 'Save keys'));
  body.appendChild(box);

  body.appendChild(el('button', { class: 'btn btn-danger', style: { width: '100%' }, onClick: () => clearAll(app, close) }, 'Clear all keys & sign out'));

  sheet.appendChild(body);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}

function keyField(labelText, which, placeholder, current, help, type = 'password') {
  const f = el('div', { class: 'field' });
  f.appendChild(el('label', {}, labelText + (current ? '  ·  set' : '')));
  f.appendChild(el('input', { type, placeholder: current ? '•••••• (leave blank to keep)' : placeholder, dataset: { which }, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' }));
  f.appendChild(el('div', { class: 'help' }, help));
  return f;
}

async function saveKeys(app, box, close) {
  for (const input of box.querySelectorAll('input[data-which]')) {
    const v = input.value.trim();
    if (v) setKey(input.dataset.which, v);
  }
  close();
  await app.refresh();
  app.toast && app.toast('Saved. Adapters updated.');
}

async function clearAll(app, close) {
  clearAllKeys();
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    } catch {
      /* embedded contexts may block this */
    }
  }
  close();
  await app.refresh();
  app.toast && app.toast('Keys cleared. Back to demo mode.');
}

function label(name) {
  return { anthropic: 'Anthropic (chat)', github: 'GitHub data repo', calendar: 'Google Calendar', strava: 'Strava', health: 'Apple Health / Garmin', schoology: 'Schoology' }[name] || name;
}
