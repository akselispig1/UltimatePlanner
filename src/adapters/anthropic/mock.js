// Anthropic adapter — mock. Drives the full chat tool-use loop from canned
// fixture responses (§5.1) with simulated streaming. Signature-identical to
// live.js.
//
// createMessage() returns ONE model turn: { text, toolCalls, stop }. The chat
// controller loops — if stop === 'tool_use' it runs the tools, appends the
// results, and calls again. turnIndex is derived from how many assistant
// messages are already in the thread, so the mock is stateless.

import * as fx from '../../fixtures.js';
import { uuid } from '../../util/id.js';

export const NAME = 'anthropic';

// The real user text — text blocks excluding the injected CURRENT STATE context
// snapshot, so keyword matching keys off what the user actually typed.
function userText(message) {
  if (typeof message.content === 'string') return message.content;
  return (message.content || [])
    .filter((b) => b.type === 'text' && !b.text.startsWith('CURRENT STATE'))
    .map((b) => b.text)
    .join(' ');
}

function pickResponse(messages) {
  const firstUser = messages.find((m) => m.role === 'user');
  const text = (firstUser ? userText(firstUser) : '').toLowerCase();
  const matched = fx.chatResponses().find((r) => r.match.some((kw) => text.includes(kw)));
  return matched || fx.CHAT_FALLBACK;
}

function toTurns(steps) {
  const turns = [];
  let cur = { text: '', toolCalls: [] };
  for (const s of steps) {
    if (s.text) cur.text += (cur.text ? ' ' : '') + s.text;
    if (s.tool) {
      cur.toolCalls.push({ id: uuid(), name: s.tool, input: s.input || {} });
      turns.push({ text: cur.text, toolCalls: cur.toolCalls, stop: 'tool_use' });
      cur = { text: '', toolCalls: [] };
    }
  }
  if (cur.text || turns.length === 0) turns.push({ text: cur.text, toolCalls: [], stop: 'end' });
  else turns.push({ text: '', toolCalls: [], stop: 'end' });
  return turns;
}

async function stream(text, onText) {
  if (!onText || !text) return;
  const words = text.split(' ');
  let buf = '';
  for (let i = 0; i < words.length; i++) {
    buf += words[i] + (i < words.length - 1 ? ' ' : '');
    if (buf.length >= 10 || i === words.length - 1) {
      onText(buf); // chunks concatenate to exactly the original text
      buf = '';
      await new Promise((r) => setTimeout(r, 8));
    }
  }
}

export async function createMessage({ messages = [], onText } = {}) {
  const turns = toTurns(pickResponse(messages).steps);
  const idx = messages.filter((m) => m.role === 'assistant').length;
  const turn = turns[idx] || { text: '', toolCalls: [], stop: 'end' };
  await stream(turn.text, onText);
  return { text: turn.text, toolCalls: turn.toolCalls, stop: turn.stop };
}

export async function verify() {
  return true;
}
