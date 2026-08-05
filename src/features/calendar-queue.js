// Calendar queue (§1.5). The chatbot and Balancer never call Google directly —
// they append intents here. A drain routine (run in-app for the demo, in an
// Action for real) empties the queue via the calendar adapter and marks each
// entry done with the resulting event id. Idempotent: only pending entries are
// processed, so it's safe to re-run (§6). Pure logic — the store and adapter are
// injected.

import { DATA_FILES } from '../config.js';
import { uuid } from '../util/id.js';

export async function enqueue(store, { action, event }) {
  const data = await store.read(DATA_FILES.calendarQueue);
  const entry = { id: `cq-${uuid()}`, action, event, status: 'pending', resultEventId: null, queuedAt: new Date().toISOString() };
  data.queue.push(entry);
  await store.write(DATA_FILES.calendarQueue, data);
  return entry;
}

export async function drainQueue(store, calendar) {
  const data = await store.read(DATA_FILES.calendarQueue);
  let done = 0;
  let errors = 0;
  for (const entry of data.queue) {
    if (entry.status !== 'pending') continue;
    try {
      let result;
      if (entry.action === 'create') result = await calendar.createEvent(entry.event);
      else if (entry.action === 'update') result = await calendar.updateEvent(entry.event.id || entry.resultEventId, entry.event);
      else if (entry.action === 'delete') result = await calendar.deleteEvent(entry.event.id || entry.resultEventId);
      else throw new Error(`unknown action: ${entry.action}`);
      entry.status = 'done';
      entry.resultEventId = result.id || entry.resultEventId || null;
      entry.error = null;
      done++;
    } catch (err) {
      entry.status = 'error';
      entry.error = String(err.message || err);
      errors++;
    }
  }
  await store.write(DATA_FILES.calendarQueue, data);
  return { done, errors, pending: data.queue.filter((e) => e.status === 'pending').length, queue: data.queue };
}

export function pendingCount(queue) {
  return (queue || []).filter((e) => e.status === 'pending').length;
}
