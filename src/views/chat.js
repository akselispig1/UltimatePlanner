// Chat — the whole app (§1: chat is the primary input, Google Calendar the
// primary output). Full-screen conversation: streaming replies, tool-call rows,
// photo attach + compress, persisted history, and inline confirmations for
// pending plans. Manages its own DOM so streaming doesn't trigger a re-render.

import { el, ICONS } from '../ui/dom.js';
import { runChat, loadHistory } from '../chat.js';
import { compressImage } from '../ui/image.js';
import { hasAnthropicKey } from '../keys.js';
import { enqueue } from '../features/calendar-queue.js';
import { store } from '../storage.js';
import { DATA_FILES } from '../config.js';

export function render(app) {
  const root = el('div', { id: 'chat-view', class: 'fade-in' });
  const scroll = el('div', { class: 'chat-scroll' });
  root.appendChild(scroll);

  // On open: a short briefing + any plans awaiting confirmation, then history.
  loadHistory(app.now, 20).then((history) => {
    const pending = (app.state?.social || []).filter((p) => p.status === 'pending');
    if (!history.length) {
      scroll.appendChild(bubble('assistant', greeting(app, pending.length)));
    }
    if (pending.length) {
      scroll.appendChild(el('div', { class: 'tool-row' }, el('span', {}, `${pending.length} plan${pending.length > 1 ? 's' : ''} to confirm — they become calendar blocks once you say yes:`)));
      for (const p of pending) scroll.appendChild(confirmCard(app, p));
    }
    for (const m of history) {
      if (m.role === 'user') scroll.appendChild(bubble('user', m.text || '[photo]'));
      else {
        for (const t of m.tools || []) scroll.appendChild(toolRow(t));
        if (m.text) scroll.appendChild(bubble('assistant', m.text));
      }
    }
    if (!hasAnthropicKey()) scroll.appendChild(el('div', { class: 'banner info' }, 'Demo chat — canned replies with real tool calls. Add your Anthropic key via the ⚙ gear to go live.'));
    scrollDown();
  });

  // Composer
  const textarea = el('textarea', { rows: '1', placeholder: 'Message…', oninput: autoGrow });
  const fileInput = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, onchange: (e) => onPhoto(e, app, scroll, textarea) });
  const composer = el('div', { class: 'chat-composer' }, fileInput, el('button', { class: 'icon-btn', title: 'Add photo', onClick: () => fileInput.click(), html: ICONS.camera }), textarea, el('button', { class: 'icon-btn btn-accent', title: 'Send', onClick: () => submit(app, scroll, textarea), html: ICONS.send }));
  root.appendChild(composer);

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(app, scroll, textarea);
    }
  });

  return root;
}

function greeting(app, pendingCount) {
  const bits = ["I'm your planner — talk to me about training, school, sleep, food and goals, and I'll put the plan on your Google Calendar."];
  if (pendingCount) bits.push(`You've got ${pendingCount} plan${pendingCount > 1 ? 's' : ''} to confirm below.`);
  else bits.push('Try: "build me a training plan", "make a fuelling plan", or send a photo of a meal.');
  return bits.join(' ');
}

// ---- inline confirmation card for a pending social plan (§3.3) ----
function confirmCard(app, plan) {
  const card = el('div', { class: 'confirm-card' });
  card.appendChild(el('div', { class: 'row-main' }, plan.what));
  card.appendChild(el('div', { class: 'row-sub' }, `${plan.who || ''}${plan.who ? ' · ' : ''}${(plan.when || '').replace('T', ' ')}${plan.where ? ' · ' + plan.where : ''}`));
  if (plan.raw) card.appendChild(el('div', { class: 'row-sub muted' }, `“${plan.raw}”`));
  const actions = el('div', { class: 'confirm-actions' });
  const yes = el('button', { class: 'btn btn-accent btn-sm', onClick: () => decide(app, plan, true, card) }, 'Confirm');
  const no = el('button', { class: 'btn btn-ghost btn-sm', onClick: () => decide(app, plan, false, card) }, 'Discard');
  actions.appendChild(yes);
  actions.appendChild(no);
  card.appendChild(actions);
  return card;
}

async function decide(app, plan, confirmed, card) {
  const data = await store.read(DATA_FILES.socialQueue);
  const p = data.plans.find((x) => x.id === plan.id);
  if (p) p.status = confirmed ? 'confirmed' : 'discarded';
  await store.write(DATA_FILES.socialQueue, data);
  if (confirmed) {
    await enqueue(store, { action: 'create', event: { title: plan.what, date: (plan.when || '').slice(0, 10), start: (plan.when || '').slice(11, 16) || '18:00', durationMin: 120, kind: 'social' } });
  }
  // Update the card in place — no full re-render.
  card.replaceChildren(el('div', { class: 'tool-row' }, el('span', { class: 'tick' }, confirmed ? '✓' : '✕'), el('span', {}, confirmed ? `Confirmed "${plan.what}" — added to your calendar.` : `Discarded "${plan.what}".`)));
  await app.reloadState();
}

function bubble(role, text) {
  return el('div', { class: `bubble ${role}` }, text);
}
function toolRow(summary) {
  return el('div', { class: 'tool-row' }, el('span', { class: 'tick' }, '✓'), el('span', {}, summary));
}
function typingRow() {
  return el('div', { class: 'typing' }, el('span', {}, '●'), el('span', {}, '●'), el('span', {}, '●'));
}
function scrollDown() {
  requestAnimationFrame(() => {
    const view = document.getElementById('view');
    if (view) view.scrollTop = view.scrollHeight;
  });
}
function autoGrow(e) {
  e.target.style.height = 'auto';
  e.target.style.height = Math.min(110, e.target.scrollHeight) + 'px';
}

async function submit(app, scroll, textarea) {
  const text = textarea.value.trim();
  if (!text) return;
  textarea.value = '';
  textarea.style.height = 'auto';
  await send(app, scroll, { text });
}

async function onPhoto(e, app, scroll, textarea) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let image;
  try {
    image = await compressImage(file);
  } catch (err) {
    scroll.appendChild(bubble('assistant', '⚠️ Could not read that image.'));
    return;
  }
  const text = textarea.value.trim();
  textarea.value = '';
  await send(app, scroll, { text, image });
}

async function send(app, scroll, { text, image }) {
  const ub = el('div', { class: 'bubble user' });
  if (image) ub.appendChild(el('img', { src: image.previewUrl, alt: 'photo' }));
  if (text) ub.appendChild(el('div', {}, text));
  scroll.appendChild(ub);

  const typing = typingRow();
  scroll.appendChild(typing);
  scrollDown();

  let current = null;
  const onText = (delta) => {
    if (typing.parentNode) typing.remove();
    if (!current) {
      current = bubble('assistant', '');
      scroll.appendChild(current);
    }
    current.textContent += delta;
    scrollDown();
  };
  const onTool = ({ summary }) => {
    if (typing.parentNode) typing.remove();
    current = null;
    scroll.appendChild(toolRow(summary));
    scrollDown();
  };

  try {
    const res = await runChat({ userText: text, image, onText, onTool, now: app.now });
    if (typing.parentNode) typing.remove();
    if (!current && res.finalText) scroll.appendChild(bubble('assistant', res.finalText));
    if (res.safety) scroll.appendChild(el('div', { class: 'banner warn' }, res.safety));
  } catch (err) {
    if (typing.parentNode) typing.remove();
    scroll.appendChild(bubble('assistant', '⚠️ ' + describeError(err)));
  }
  scrollDown();
  await app.reloadState();
}

function describeError(err) {
  const m = String(err && err.message ? err.message : err);
  if (/401|403|invalid/i.test(m)) return 'Your Anthropic key was rejected — check it via the ⚙ gear.';
  if (/Failed to fetch|network/i.test(m)) return "Can't reach the API — you may be offline.";
  return 'Something went wrong: ' + m;
}
