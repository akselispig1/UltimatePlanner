// App entry: boot, service-worker registration, bottom nav, routing, and the
// render loop. Every view runs fully on mock data with no keys.

import { el, clear, ICONS } from './ui/dom.js';
import { gatherState } from './app-data.js';
import { store } from './storage.js';
import { DATA_FILES } from './config.js';
import { isDemoMode } from './keys.js';
import * as today from './views/today.js';
import * as training from './views/training.js';
import * as school from './views/school.js';
import * as chat from './views/chat.js';
import * as me from './views/me.js';

const ROUTES = {
  today: { view: today, label: 'Today', icon: 'today' },
  training: { view: training, label: 'Training', icon: 'training' },
  school: { view: school, label: 'School', icon: 'school' },
  chat: { view: chat, label: 'Chat', icon: 'chat', center: true },
  me: { view: me, label: 'Me', icon: 'me' },
};

export const App = {
  state: null,
  now: new Date(),
  route: 'today',

  async reloadState() {
    this.state = await gatherState(this.now);
    updateDemoBar();
    return this.state;
  },

  render() {
    const view = document.getElementById('view');
    if (!view) return;
    clear(view);
    try {
      view.appendChild(ROUTES[this.route].view.render(this));
    } catch (err) {
      // Never a blank screen or silent catch (§5.3).
      view.appendChild(el('div', { class: 'banner warn' }, `This view hit an error: ${err.message}`));
      console.error('[view error]', this.route, err);
    }
    renderNav();
  },

  async refresh() {
    await this.reloadState();
    this.render();
  },

  navigate(route) {
    if (!ROUTES[route]) return;
    this.route = route;
    this.render();
    const view = document.getElementById('view');
    if (view) view.scrollTop = 0;
  },

  toast(msg) {
    const t = el('div', { class: 'banner info', style: { position: 'fixed', left: '16px', right: '16px', bottom: 'calc(var(--nav-h) + 80px)', zIndex: 60, textAlign: 'center', maxWidth: '608px', margin: '0 auto' } }, msg);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  },
};

function renderNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  clear(nav);
  for (const [key, r] of Object.entries(ROUTES)) {
    const active = key === App.route;
    const iconEl = r.center
      ? el('div', { class: 'ico-wrap', html: ICONS[r.icon] })
      : el('span', { class: 'ico', html: ICONS[r.icon] });
    nav.appendChild(el('button', { class: `nav-item ${r.center ? 'chat' : ''} ${active ? 'active' : ''}`.trim(), onClick: () => App.navigate(key) }, iconEl, el('span', {}, r.label)));
  }
}

function updateDemoBar() {
  const bar = document.getElementById('demo-bar');
  if (bar) bar.classList.toggle('hidden', !isDemoMode());
}

async function boot() {
  await App.reloadState();
  App.render();
  registerServiceWorker();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW register failed', err));
  }
}

// Expose for the headless check (§5.3) to drive and assert against. These are
// read-only introspection hooks — no keys or secrets pass through them.
window.__lifeBalancer = App;
window.__store = store;
window.__DATA_FILES = DATA_FILES;
window.__appReady = boot().then(() => {
  window.__booted = true;
});
