// Nightly Balancer (§3.7). Composes tomorrow: fixed commitments (school,
// confirmed social) → training slot → study blocks → DUE + trip events, and
// appends the resulting calendar intents to data/calendar-queue.json. The
// calendar-sync workflow does the actual Google write. Idempotent: entries carry
// a stable `key`, and we never append a duplicate key.
import { readJSON, writeJSON } from './lib.mjs';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TRAIN_START = { ride: '16:30', gym: '17:15', run: '16:30' };

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const date = tomorrowISO();
  const weekday = WEEKDAYS[new Date(date + 'T00:00').getDay()];
  const plan = await readJSON('data/training-plan.json', { sessions: [] });
  const school = await readJSON('data/schoology.json', { assignments: [], trips: [] });
  const social = await readJSON('data/social-queue.json', { plans: [] });
  const queue = await readJSON('data/calendar-queue.json', { queue: [] });

  const have = new Set(queue.queue.map((e) => e.key).filter(Boolean));
  const add = (key, action, event) => {
    if (have.has(key)) return;
    queue.queue.push({ id: `cq-${key}`, key, action, event, status: 'pending', resultEventId: null, queuedAt: new Date().toISOString() });
    have.add(key);
  };

  const trip = (school.trips || []).find((t) => date >= t.date && date <= (t.endDate || t.date));
  if (trip) {
    add(`trip-${trip.id}`, 'create', { title: trip.title, date: trip.date, endDate: trip.endDate, allDay: true });
  } else {
    // Training slot.
    const session = (plan.sessions || []).find((s) => s.day === weekday && s.type !== 'rest' && s.durationMin > 0);
    if (session) add(`train-${date}`, 'create', { title: `${session.type} (${session.intensity})`, date, start: TRAIN_START[session.type] || '16:30', durationMin: session.durationMin });
    // DUE events for anything due tomorrow.
    for (const a of (school.assignments || []).filter((x) => x.status === 'open' && x.due === date)) {
      add(`due-${a.id}`, 'create', { title: `DUE: ${a.title}`, date, allDay: true });
    }
  }
  // Confirmed social becomes a fixed block.
  for (const p of (social.plans || []).filter((x) => x.status === 'confirmed' && (x.when || '').slice(0, 10) === date)) {
    add(`social-${p.id}`, 'create', { title: p.what, date, start: (p.when || '').slice(11, 16) || '18:00', durationMin: 120 });
  }

  await writeJSON('data/calendar-queue.json', queue);
  console.log(`balancer: composed ${date} (${weekday}); queue now ${queue.queue.length} entries`);
  // A morning push (§5.5) can read this summary; left as an optional Phase 7 hook.
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
