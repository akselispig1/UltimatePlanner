// The chatbot's tools. One job: put things on the user's Google Calendar. The
// core is queue_calendar_change (schedule anything the user describes); two
// helpers cover the saved weekly training plan. Each writes real JSON and
// returns a plain-language summary.

import { store } from './storage.js';
import { DATA_FILES } from './config.js';
import { enqueue } from './features/calendar-queue.js';
import { datedSessions } from './features/training.js';
import { offsetToIso } from './util/dates.js';

// Default calendar start time for a training session by type.
const TRAIN_START = { ride: '16:30', gym: '17:15', run: '16:30' };

// Turn a possibly-relative event date ("+1") into an ISO date.
function resolveEventDate(event, now) {
  if (event && typeof event.date === 'string' && /^[+-]\d+$/.test(event.date)) {
    return { ...event, date: offsetToIso(Number(event.date), now) };
  }
  return event;
}

export const TOOLS = {
  queue_calendar_change: {
    description: 'Add, move, or delete a single calendar event. The core tool — use it for anything the user asks to put on their calendar. Call once per event.',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'update', 'delete'] },
        event: {
          type: 'object',
          description: 'title, date (YYYY-MM-DD or a relative "+1"), optional start (HH:MM), durationMin, allDay.',
        },
      },
      required: ['action', 'event'],
    },
    async run(input = {}, { now = new Date() } = {}) {
      const event = resolveEventDate(input.event || {}, now);
      const entry = await enqueue(store, { action: input.action, event });
      return { summary: `Queued ${input.action} "${event.title || 'event'}" — it'll appear on Google Calendar after the next sync.`, data: { id: entry.id } };
    },
  },

  add_training_to_calendar: {
    description: "Put the saved weekly training plan's sessions onto Google Calendar for the week(s) ahead.",
    input_schema: {
      type: 'object',
      properties: { weeks: { type: 'number', description: 'How many weeks ahead to schedule (default 1).' } },
    },
    async run(input = {}, { now = new Date() } = {}) {
      const weeks = Math.max(1, Math.min(6, input.weeks || 1));
      const plan = await store.read(DATA_FILES.trainingPlan);
      const sessions = datedSessions(plan, 0, weeks * 7 - 1, now).filter((s) => s.type !== 'rest' && s.durationMin > 0);
      for (const s of sessions) {
        await enqueue(store, { action: 'create', event: { title: `${cap(s.type)} — ${s.intensity}${s.note ? ' (' + s.note + ')' : ''}`, date: s.date, start: TRAIN_START[s.type] || '16:30', durationMin: s.durationMin, kind: 'training' } });
      }
      return { summary: `Added ${sessions.length} training session${sessions.length === 1 ? '' : 's'} to your calendar for the ${weeks === 1 ? 'week' : weeks + ' weeks'} ahead.`, data: { count: sessions.length } };
    },
  },

  adjust_training_plan: {
    description: 'Edit one day of the saved weekly training plan (type, duration, intensity, note).',
    input_schema: {
      type: 'object',
      properties: {
        day: { type: 'string', enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
        type: { type: 'string' },
        durationMin: { type: 'number' },
        intensity: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['day'],
    },
    async run(input = {}, { now = new Date() } = {}) {
      const data = await store.read(DATA_FILES.trainingPlan);
      const session = data.sessions.find((s) => s.day === input.day);
      if (!session) return { summary: `No session found for ${input.day}.`, data: null };
      const before = { ...session };
      for (const k of ['type', 'durationMin', 'intensity', 'note']) if (input[k] !== undefined) session[k] = input[k];
      data.updatedAt = new Date(now).toISOString();
      await store.write(DATA_FILES.trainingPlan, data);
      return { summary: `Updated ${input.day}: ${before.intensity} ${before.type} → ${session.intensity} ${session.type}.`, data: { day: input.day } };
    },
  },
};

function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function toolSchemas() {
  return Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, input_schema: t.input_schema }));
}

export async function runTool(name, input, ctx = {}) {
  const tool = TOOLS[name];
  if (!tool) return { summary: `Unknown tool: ${name}`, data: null, error: true };
  try {
    return await tool.run(input, ctx);
  } catch (err) {
    return { summary: `Tool ${name} failed: ${err.message}`, data: null, error: true };
  }
}
