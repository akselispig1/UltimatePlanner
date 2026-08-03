// Chat controller (§3.6). Builds the context snapshot, runs the full tool-use
// loop against the Anthropic adapter (mock or live), streams text, executes the
// six tools, and persists history to /data/chat/YYYY-MM.json. Adapter-agnostic:
// the mock and live adapters return the same { text, toolCalls, stop } shape.

import { getAdapter } from './adapters/index.js';
import { buildSystemPrompt } from './config.js';
import { toolSchemas, runTool } from './tools.js';
import { gatherState } from './app-data.js';
import { buildSnapshot } from './context.js';
import { restrictionCheck } from './features/nutrition.js';
import { store } from './storage.js';
import { monthKey } from './util/dates.js';

const MAX_TOOL_ROUNDS = 6;

function chatFileKey(now = new Date()) {
  return `data/chat/${monthKey(now)}.json`;
}

export async function loadHistory(now = new Date(), limit = 20) {
  try {
    const data = await store.read(chatFileKey(now));
    return (data.messages || []).slice(-limit);
  } catch {
    return [];
  }
}

async function appendHistory(entries, now = new Date()) {
  const key = chatFileKey(now);
  let data;
  try {
    data = await store.read(key);
  } catch {
    data = { messages: [] };
  }
  if (!data.messages) data.messages = [];
  data.messages.push(...entries);
  await store.write(key, data);
}

// Run one user turn to completion. Callbacks:
//   onText(delta)             streaming assistant text
//   onTool({name,input,summary})  each tool call as it resolves
// image (optional): { mediaType, dataBase64 }
export async function runChat({ userText, image = null, onText, onTool, now = new Date() } = {}) {
  const anthropic = getAdapter('anthropic');
  const state = await gatherState(now);
  const snapshot = buildSnapshot(state);

  const userContent = [{ type: 'text', text: `CURRENT STATE (compact JSON):\n${JSON.stringify(snapshot)}` }];
  if (userText) userContent.push({ type: 'text', text: userText });
  if (image) userContent.push({ type: 'image', mediaType: image.mediaType, dataBase64: image.dataBase64 });

  const messages = [{ role: 'user', content: userContent }];
  const toolCallsMade = [];
  let finalText = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const turn = await anthropic.createMessage({ system: buildSystemPrompt(), messages, tools: toolSchemas(), onText });
    finalText = turn.text || finalText;

    const assistantBlocks = [];
    if (turn.text) assistantBlocks.push({ type: 'text', text: turn.text });
    for (const tc of turn.toolCalls || []) assistantBlocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
    messages.push({ role: 'assistant', content: assistantBlocks });

    if (turn.stop !== 'tool_use' || !(turn.toolCalls && turn.toolCalls.length)) break;

    const resultBlocks = [];
    for (const tc of turn.toolCalls) {
      const result = await runTool(tc.name, tc.input, { now });
      toolCallsMade.push({ name: tc.name, input: tc.input, summary: result.summary });
      if (onTool) onTool({ name: tc.name, input: tc.input, summary: result.summary });
      resultBlocks.push({ type: 'tool_result', toolUseId: tc.id, content: JSON.stringify({ summary: result.summary, data: result.data ?? null }) });
    }
    messages.push({ role: 'user', content: resultBlocks });
  }

  // Persist a compact record of the exchange.
  await appendHistory(
    [
      { role: 'user', text: userText || (image ? '[photo]' : ''), at: new Date().toISOString() },
      { role: 'assistant', text: finalText, tools: toolCallsMade.map((t) => t.summary), at: new Date().toISOString() },
    ],
    now
  );

  return { finalText, toolCalls: toolCallsMade, safety: restrictionCheck(userText) };
}
