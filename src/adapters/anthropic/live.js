// Anthropic adapter — live. Calls the Messages API directly from the browser,
// which requires the anthropic-dangerous-direct-browser-access header (§1.4).
// Streams text deltas through onText and collects tool_use blocks. Returns ONE
// model turn shaped like the mock so the chat controller is adapter-agnostic.
import { getAnthropicKey } from '../../keys.js';
import { buildSystemPrompt } from '../../config.js';

export const NAME = 'anthropic';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5';

// Map our internal blocks to the Anthropic content shape.
function toApiMessages(messages) {
  return messages.map((m) => {
    if (typeof m.content === 'string') return { role: m.role, content: m.content };
    const content = m.content.map((b) => {
      if (b.type === 'image') return { type: 'image', source: { type: 'base64', media_type: b.mediaType, data: b.dataBase64 } };
      if (b.type === 'tool_use') return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
      if (b.type === 'tool_result') return { type: 'tool_result', tool_use_id: b.toolUseId, content: b.content };
      return { type: 'text', text: b.text };
    });
    return { role: m.role, content };
  });
}

export async function createMessage({ system, messages = [], tools = [], onText } = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': getAnthropicKey(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      stream: true,
      system: system || buildSystemPrompt(),
      tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
      messages: toApiMessages(messages),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`);
  }

  // Parse the SSE stream: accumulate text deltas and tool_use blocks.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let stop = 'end';
  const toolCalls = [];
  const partialTool = {}; // index -> { id, name, jsonStr }

  const handle = (evt) => {
    if (evt.type === 'content_block_start' && evt.content_block?.type === 'tool_use') {
      partialTool[evt.index] = { id: evt.content_block.id, name: evt.content_block.name, jsonStr: '' };
    } else if (evt.type === 'content_block_delta') {
      if (evt.delta?.type === 'text_delta') {
        text += evt.delta.text;
        if (onText) onText(evt.delta.text);
      } else if (evt.delta?.type === 'input_json_delta' && partialTool[evt.index]) {
        partialTool[evt.index].jsonStr += evt.delta.partial_json;
      }
    } else if (evt.type === 'message_delta' && evt.delta?.stop_reason) {
      stop = evt.delta.stop_reason === 'tool_use' ? 'tool_use' : 'end';
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        handle(JSON.parse(payload));
      } catch {
        /* ignore keep-alive / partial */
      }
    }
  }

  for (const p of Object.values(partialTool)) {
    let input = {};
    try {
      input = p.jsonStr ? JSON.parse(p.jsonStr) : {};
    } catch {
      input = {};
    }
    toolCalls.push({ id: p.id, name: p.name, input });
  }
  return { text, toolCalls, stop: toolCalls.length ? 'tool_use' : stop };
}

export async function verify() {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': getAnthropicKey(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
