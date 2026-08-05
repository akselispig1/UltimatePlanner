// Calendar adapter — mock. Used by the queue-drain routine (§1.5). Records writes
// in memory and returns an event id so the demo can show queued→done.
// Signature-identical to live.js.
import { uuid } from '../../util/id.js';

export const NAME = 'calendar';

const written = [];

export async function createEvent(event) {
  const id = 'mockcal-' + uuid();
  written.push({ op: 'create', id, event });
  return { id };
}

export async function updateEvent(id, event) {
  written.push({ op: 'update', id, event });
  return { id };
}

export async function deleteEvent(id) {
  written.push({ op: 'delete', id });
  return { id, deleted: true };
}

export async function verify() {
  return true;
}
