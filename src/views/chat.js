// Chat — the whole app. One job: talk to the bot and it puts things on your
// Google Calendar. Streaming replies, tool-call rows, persisted history.

import { el, ICONS } from '../ui/dom.js';
import { runChat, loadHistory } from '../chat.js';
import { hasAnthropicKey } from '../keys.js';

export function render(app) {
  const root = el('div', { id: 'chat-view', class: 'fade-in' });
  const scroll = el('div', { class: 'chat-scroll' });
  root.appendChild(scroll);

  loadHistory(app.now, 20).then((history) => {
    if (!history.length) scroll.appendChild(bubble('assistant', greeting()));
    for (const m of history) {
      if (m.role === 'user') scroll.appendChild(bubble('user', m.text || ''));
      else {
        for (const t of m.tools || []) scroll.appendChild(toolRow(t));
        if (m.text) scroll.appendChild(bubble('assistant', m.text));
      }
    }
    if (!hasAnthropicKey()) scroll.appendChild(el('div', { class: 'banner info' }, 'Demo chat — canned replies with real tool calls. Add your Anthropic key via the ⚙ gear to go live.'));
    scrollDown();
  });

  const textarea = el('textarea', { rows: '1', placeholder: 'Ask me to schedule something…', oninput: autoGrow });
  const composer = el('div', { class: 'chat-composer' }, textarea, el('button', { class: 'icon-btn btn-accent', title: 'Send', onClick: () => submit(app, scroll, textarea), html: ICONS.send }));
  root.appendChild(composer);

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(app, scroll, textarea);
    }
  });

  return root;
}

function greeting() {
  return "I put things on your Google Calendar. Just tell me — \"add football practice tomorrow at 5\", \"dentist next Monday 9am\", or \"put my training plan on my calendar\".";
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
  await send(app, scroll, text);
}

async function send(app, scroll, text) {
  scroll.appendChild(bubble('user', text));
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
    const res = await runChat({ userText: text, onText, onTool, now: app.now });
    if (typing.parentNode) typing.remove();
    if (!current && res.finalText) scroll.appendChild(bubble('assistant', res.finalText));
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
