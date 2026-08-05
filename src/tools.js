// The chatbot's tools. One job: put things on the user's Google Calendar —
// their training plan, their assignments/study time, and one-off requests. Each
// tool writes real JSON (the calendar queue / plan / study blocks) and returns a
// plain-language summary of what it scheduled.

import { store } from './storage.js';
import { DATA_FILES } from './config.js';
import { gatherState } from './app-data.js';
import { enqueue } from './features/calendar-queue.js';
import { scheduleOne, dueEventFor, generateStudyBlocks } from './features/school.js';
import { datedSessions } from './features/training.js';
import { uuid } from './util/id.js';
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
  adjust_training_plan: {
    description: 'Edit one day of the weekly training plan (type, duration, intensity, note).',
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

  add_training_to_calendar: {
    description: "Put the training plan's sessions onto Google Calendar for the week(s) ahead.",
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

  add_assignments_to_calendar: {
    description: 'Put open assignment due dates onto Google Calendar, optionally with study blocks scheduled in free time.',
    input_schema: {
      type: 'object',
      properties: { includeStudyBlocks: { type: 'boolean' } },
    },
    async run(input = {}, { now = new Date() } = {}) {
      const state = await gatherState(now);
      const todayIso = offsetToIso(0, now);
      const open = state.assignments.filter((a) => a.status === 'open' && a.due >= todayIso);
      for (const a of open) await enqueue(store, { action: 'create', event: dueEventFor(a) });

      let blocks = [];
      if (input.includeStudyBlocks) {
        blocks = generateStudyBlocks({ assignments: state.assignments, plan: state.plan, externalCal: state.externalCal, existingBlocks: state.studyBlocks, now });
        if (blocks.length) {
          const sb = await store.read(DATA_FILES.studyBlocks);
          sb.blocks.push(...blocks);
          await store.write(DATA_FILES.studyBlocks, sb);
          for (const b of blocks) await enqueue(store, { action: 'create', event: { title: b.title, date: b.date, start: b.start, durationMin: b.durationMin, kind: 'study' } });
        }
      }
      const extra = blocks.length ? ` and ${blocks.length} study block${blocks.length === 1 ? '' : 's'}` : '';
      return { summary: `Added ${open.length} assignment due date${open.length === 1 ? '' : 's'}${extra} to your calendar.`, data: { dues: open.length, blocks: blocks.length } };
    },
  },

  create_study_block: {
    description: 'Schedule a study block for a specific assignment and queue it to the calendar.',
    input_schema: {
      type: 'object',
      properties: {
        assignmentId: { type: 'string' },
        assignmentTitle: { type: 'string' },
        durationMin: { type: 'number' },
      },
    },
    async run(input = {}, { now = new Date() } = {}) {
      const state = await gatherState(now);
      const asg =
        (input.assignmentId && state.assignments.find((a) => a.id === input.assignmentId)) ||
        (input.assignmentTitle && state.assignments.find((a) => a.title.toLowerCase().includes(input.assignmentTitle.toLowerCase())));
      const title = asg ? asg.title : input.assignmentTitle || 'Study';
      const block = scheduleOne({ title, assignmentId: asg ? asg.id : null, course: asg ? asg.course : null, durationMin: input.durationMin || 60, plan: state.plan, externalCal: state.externalCal, existingBlocks: state.studyBlocks, now });
      if (!block) return { summary: `Couldn't find a free slot for a study block on "${title}".`, data: null };
      const sb = await store.read(DATA_FILES.studyBlocks);
      sb.blocks.push(block);
      await store.write(DATA_FILES.studyBlocks, sb);
      await enqueue(store, { action: 'create', event: { title: block.title, date: block.date, start: block.start, durationMin: block.durationMin, kind: 'study' } });
      return { summary: `Scheduled ${block.durationMin}min study for "${title}" on ${block.date} at ${block.start}, queued to your calendar.`, data: { id: block.id } };
    },
  },

  queue_calendar_change: {
    description: 'Add, move, or delete a single one-off calendar event.',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'update', 'delete'] },
        event: { type: 'object' },
      },
      required: ['action', 'event'],
    },
    async run(input = {}, { now = new Date() } = {}) {
      const event = resolveEventDate(input.event || {}, now);
      const entry = await enqueue(store, { action: input.action, event });
      return { summary: `Queued ${input.action} "${event.title || 'event'}" — it'll appear on Google Calendar after the next sync.`, data: { id: entry.id } };
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
