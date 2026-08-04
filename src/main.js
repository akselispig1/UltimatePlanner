// App entry. The app is a single full-screen chat (§1: chat is the primary
// input surface, Google Calendar the primary output). No dashboards, no nav —
// just the conversation, plus a gear that opens the setup sheet for keys.

import { el, clear, ICONS } from './ui/dom.js';
import { gatherState } from './app-data.js';
import { store } from './storage.js';
import { DATA_FILES } from './config.js';
import { isDemoMode } from './keys.js';
import * as chat from './views/chat.js';
import * as food from './views/food.js';
import { openSettings } from './views/settings.js';

// The app is chat-first. The one extra page is Food & fuelling — meal advice
// doesn't belong on a calendar (§3.5). Everything else stays in chat.
const ROUTES = { chat: chat.render, food: food.render };

export const App = {
  state: null,
  now: new Date(),
  route: 'chat',

  async reloadState() {
    this.state = await gatherState(this.now);
    updateDemoBar();
    return this.state;
  },

  render() {
    renderHeader();
    const view = document.getElementById('view');
    if (!view) return;
    clear(view);
    try {
      view.appendChild((ROUTES[this.route] || ROUTES.chat)(this));
    } catch (err) {
      // Never a blank screen or silent catch (§5.3).
      view.appendChild(el('div', { class: 'banner warn' }, `This screen hit an error: ${err.message}`));
      console.error('[view error]', this.route, err);
    }
  },

  navigate(route) {
    if (!ROUTES[route]) return;
    this.route = route;
    this.render();
    const view = document.getElementById('view');
    if (view) view.scrollTop = 0;
  },

  async refresh() {
    await this.reloadState();
    this.render();
  },

  toast(msg) {
    const t = el('div', { class: 'banner info toast' }, msg);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  },
};

function renderHeader() {
  const bar = document.getElementById('topbar');
  if (!bar) return;
  clear(bar);
  bar.appendChild(el('button', { class: 'brand', onClick: () => App.navigate('chat') }, 'Life Balancer'));
  const actions = el('div', { class: 'topbar-actions' });
  const onFood = App.route === 'food';
  actions.appendChild(el('button', { class: `icon-btn hdr ${onFood ? 'active' : ''}`.trim(), title: onFood ? 'Back to chat' : 'Food & fuelling', onClick: () => App.navigate(onFood ? 'chat' : 'food'), html: ICONS.food }));
  actions.appendChild(el('button', { class: 'icon-btn hdr', title: 'Setup', onClick: () => openSettings(App), html: ICONS.settings }));
  bar.appendChild(actions);
}

function updateDemoBar() {
  const b = document.getElementById('demo-bar');
  if (b) b.classList.toggle('hidden', !isDemoMode());
}

async function boot() {
  await App.reloadState();
  App.render();
  registerServiceWorker();
}

function registerServiceWorker() {
  if (window.__NO_SW__) return;
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    try {
      navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW register failed', err));
    } catch (err) {
      console.warn('SW register unavailable', err);
    }
  }
}

// Read-only introspection hooks for the headless check (§5.3). No secrets pass
// through them.
window.__lifeBalancer = App;
window.__store = store;
window.__DATA_FILES = DATA_FILES;
window.__openSettings = () => openSettings(App);
window.__appReady = boot().then(() => {
  window.__booted = true;
});
