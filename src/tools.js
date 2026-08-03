// The six chatbot tools (§3.6). Each actually reads and writes the JSON data
// files, and returns a plain-language summary of what changed (§3.6 "Any tool
// that writes must state what it changed"). The store and adapters are the real
// ones; in demo mode they're backed by mocks.

import { store } from './storage.js';
import { DATA_FILES } from './config.js';
import { gatherState } from './app-data.js';
import { enqueue } from './features/calendar-queue.js';
import { scheduleOne } from './features/school.js';
import { withProgress } from './features/goals.js';
import { datedSessions, withCompletion } from './features/training.js';
import { recentSleep } from './features/recovery.js';
import { uuid } from './util/id.js';
import { offsetToIso } from './util/dates.js';

// Turn a possibly-relative event date ("+1") into an ISO date.
function resolveEventDate(event, now) {
  if (event && typeof event.date === 'string' && /^[+-]\d+$/.test(event.date)) {
    return { ...event, date: offsetToIso(Number(event.date), now) };
  }
  return event;
}

export const TOOLS = {
  get_history: {
    description: 'Pull a wider date range of training and sleep than the default snapshot.',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'How many days back to include.' },
        focus: { type: 'string', enum: ['training', 'sleep', 'all'] },
      },
    },
    async run(input = {}, { now = new Date() } = {}) {
      const days = Math.max(1, Math.min(120, input.days || 28));
      const state = await gatherState(now);
      const training = withCompletion(datedSessions(state.plan, -days, 0, now), state.activities, now).map((s) => ({ date: s.date, type: s.type, intensity: s.intensity, status: s.status }));
      const sleep = recentSleep(state.sleep, days, now).map((s) => ({ date: s.date, score: s.score, durationMin: s.durationMin }));
      const focus = input.focus || 'all';
      const data = {};
      if (focus !== 'sleep') data.training = training;
      if (focus !== 'training') data.sleep = sleep;
      return { summary: `Loaded ${days} days of history.`, data };
    },
  },

  set_goal: {
    description: 'Create or update a goal in goals.json. Progress is computed from data, never set here.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        type: { type: 'string', enum: ['performance', 'consistency', 'school', 'recovery'] },
        target: { type: 'string' },
        metric: { type: 'string' },
        targetValue: { type: 'number' },
        deadline: { type: 'string' },
      },
      required: ['title', 'type', 'target'],
    },
    async run(input = {}, { now = new Date() } = {}) {
      const data = await store.read(DATA_FILES.goals);
      let goal = input.id && data.goals.find((g) => g.id === input.id);
      if (goal) {
        Object.assign(goal, input);
      } else {
        goal = {
          id: `goal-${uuid()}`,
          title: input.title,
          type: input.type,
          target: input.target,
          metric: input.metric || null,
          targetValue: input.targetValue ?? null,
          deadline: input.deadline || null,
          createdAt: offsetToIso(0, now),
          status: 'active',
        };
        data.goals.push(goal);
      }
      await store.write(DATA_FILES.goals, data);
      return { summary: `Saved goal "${goal.title}" (${goal.type}).`, data: { id: goal.id } };
    },
  },

  adjust_training_plan: {
    description: 'Modify one weekly session in training-plan.json (type, duration, intensity, note).',
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

  log_entry: {
    description: 'Write a nutrition, weight, or subjective note to logs.json.',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['nutrition', 'weight', 'subjective'] },
        text: { type: 'string' },
        value: { type: 'number' },
      },
      required: ['kind'],
    },
    async run(input = {}) {
      const data = await store.read(DATA_FILES.logs);
      const entry = { id: `log-${uuid()}`, kind: input.kind, at: new Date().toISOString() };
      if (input.text !== undefined) entry.text = input.text;
      if (input.value !== undefined) entry.value = input.value;
      data.entries.push(entry);
      await store.write(DATA_FILES.logs, data);
      const detail = input.kind === 'weight' ? `${input.value} kg` : input.text || '';
      return { summary: `Logged ${input.kind}: ${detail}.`, data: { id: entry.id } };
    },
  },

  queue_calendar_change: {
    description: 'Append a calendar intent to the queue (create/update/delete). Shows as pending until the sync job runs.',
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
      return { summary: `Queued ${input.action} "${event.title || 'event'}" — pending calendar sync.`, data: { id: entry.id } };
    },
  },

  create_study_block: {
    description: 'Schedule a study block against a specific assignment and queue it to the calendar.',
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
      const block = scheduleOne({
        title,
        assignmentId: asg ? asg.id : null,
        course: asg ? asg.course : null,
        durationMin: input.durationMin || 60,
        plan: state.plan,
        externalCal: state.externalCal,
        social: state.social,
        existingBlocks: state.studyBlocks,
        now,
      });
      if (!block) return { summary: `Couldn't find a free slot for a study block on "${title}".`, data: null };
      const sb = await store.read(DATA_FILES.studyBlocks);
      sb.blocks.push(block);
      await store.write(DATA_FILES.studyBlocks, sb);
      await enqueue(store, { action: 'create', event: { title: block.title, date: block.date, start: block.start, durationMin: block.durationMin, kind: 'study' } });
      return { summary: `Scheduled ${block.durationMin}min study for "${title}" on ${block.date} at ${block.start}, queued to calendar.`, data: { id: block.id } };
    },
  },
};

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
