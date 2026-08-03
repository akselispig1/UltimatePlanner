// Chat view (§3.6, §4). Full-screen conversation: streaming replies, tool calls
// as thin inline rows, photo attach + compress, and persisted history. Manages
// its own DOM so streaming doesn't trigger a full re-render.

import { el, ICONS } from '../ui/dom.js';
import { runChat, loadHistory } from '../chat.js';
import { compressImage } from '../ui/image.js';
import { hasAnthropicKey } from '../keys.js';

export function render(app) {
  const root = el('div', { id: 'chat-view', class: 'fade-in' });
  const scroll = el('div', { class: 'chat-scroll' });
  root.appendChild(scroll);

  // Load persisted history (last 20).
  loadHistory(app.now, 20).then((history) => {
    if (!history.length) {
      scroll.appendChild(el('div', { class: 'empty' }, 'Ask about training, school, sleep or food. Send a photo of a meal or the scale. This is where goals get set.'));
    }
    for (const m of history) {
      if (m.role === 'user') scroll.appendChild(bubble('user', m.text || '[photo]'));
      else {
        for (const t of m.tools || []) scroll.appendChild(toolRow(t));
        if (m.text) scroll.appendChild(bubble('assistant', m.text));
      }
    }
    scrollDown(scroll);
  });

  // Composer
  const textarea = el('textarea', { rows: '1', placeholder: 'Message…', oninput: autoGrow });
  const fileInput = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, onchange: (e) => onPhoto(e, app, scroll, textarea) });
  const composer = el('div', { class: 'chat-composer' }, fileInput, el('button', { class: 'icon-btn', title: 'Add photo', onClick: () => fileInput.click(), html: ICONS.camera }), textarea, el('button', { class: 'icon-btn btn-accent', title: 'Send', onClick: () => submit(app, scroll, textarea), html: ICONS.send }));
  root.appendChild(composer);

  // Enter to send (Shift+Enter for newline)
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(app, scroll, textarea);
    }
  });

  if (!hasAnthropicKey()) {
    // Demo-mode note; chat still works on canned responses.
    scroll.appendChild(el('div', { class: 'banner info', style: { marginTop: '4px' } }, 'Demo chat — canned responses with real tool calls. Add your Anthropic key in Me → Setup to go live.'));
  }

  return root;
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
function scrollDown(scroll) {
  requestAnimationFrame(() => {
    const view = document.getElementById('view');
    if (view) view.scrollTop = view.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
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
  // user bubble (with optional photo preview)
  const ub = el('div', { class: 'bubble user' });
  if (image) ub.appendChild(el('img', { src: image.previewUrl, alt: 'photo' }));
  if (text) ub.appendChild(el('div', {}, text));
  scroll.appendChild(ub);

  const typing = typingRow();
  scroll.appendChild(typing);
  scrollDown(scroll);

  let current = null;
  const onText = (delta) => {
    if (typing.parentNode) typing.remove();
    if (!current) {
      current = bubble('assistant', '');
      scroll.appendChild(current);
    }
    current.textContent += delta;
    scrollDown(scroll);
  };
  const onTool = ({ summary }) => {
    if (typing.parentNode) typing.remove();
    current = null; // next text starts a fresh bubble after the tool row
    scroll.appendChild(toolRow(summary));
    scrollDown(scroll);
  };

  try {
    const res = await runChat({ userText: text, image, onText, onTool, now: app.now });
    if (typing.parentNode) typing.remove();
    if (!current && res.finalText) scroll.appendChild(bubble('assistant', res.finalText));
    if (res.safety) scroll.appendChild(el('div', { class: 'banner warn' }, res.safety));
  } catch (err) {
    if (typing.parentNode) typing.remove();
    const msg = describeError(err);
    scroll.appendChild(bubble('assistant', '⚠️ ' + msg));
  }
  scrollDown(scroll);
  await app.reloadState();
}

function describeError(err) {
  const m = String(err && err.message ? err.message : err);
  if (/401|403|invalid/i.test(m)) return 'Your Anthropic key was rejected. Check it in Me → Setup.';
  if (/Failed to fetch|network/i.test(m)) return "Can't reach the API — you may be offline.";
  return 'Something went wrong: ' + m;
}
