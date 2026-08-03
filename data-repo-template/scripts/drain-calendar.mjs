// Drain data/calendar-queue.json to Google Calendar (§1.5). Idempotent: only
// touches `pending` entries; marks each `done` with the resulting event id, or
// `error` with a message. Safe to re-run.
import { readJSON, writeJSON, recordStatus, refreshAccessToken } from './lib.mjs';

const QUEUE = 'data/calendar-queue.json';
const CAL = process.env.GOOGLE_CALENDAR_ID || 'primary';
const BASE = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL)}/events`;

// Convert a queue event into a Google event resource.
function toGoogle(ev) {
  if (ev.allDay) {
    return { summary: ev.title, start: { date: ev.date }, end: { date: ev.endDate || ev.date } };
  }
  const startISO = `${ev.date}T${(ev.start || '09:00')}:00`;
  const endMin = (ev.durationMin || 60);
  const end = new Date(new Date(startISO).getTime() + endMin * 60000);
  const pad = (n) => String(n).padStart(2, '0');
  const endISO = `${ev.date}T${pad(end.getHours())}:${pad(end.getMinutes())}:00`;
  return { summary: ev.title, description: ev.description || '', start: { dateTime: startISO }, end: { dateTime: endISO } };
}

async function main() {
  const data = await readJSON(QUEUE, { queue: [] });
  const pending = data.queue.filter((e) => e.status === 'pending');
  if (!pending.length) {
    console.log('nothing to drain');
    return;
  }
  const tok = await refreshAccessToken({
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  });
  const headers = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' };

  for (const entry of pending) {
    try {
      let res;
      if (entry.action === 'create') res = await fetch(BASE, { method: 'POST', headers, body: JSON.stringify(toGoogle(entry.event)) });
      else if (entry.action === 'update') res = await fetch(`${BASE}/${entry.resultEventId || entry.event.id}`, { method: 'PATCH', headers, body: JSON.stringify(toGoogle(entry.event)) });
      else if (entry.action === 'delete') res = await fetch(`${BASE}/${entry.resultEventId || entry.event.id}`, { method: 'DELETE', headers });
      if (!res.ok && res.status !== 410) throw new Error(`${entry.action} ${res.status}`);
      const json = entry.action === 'delete' ? {} : await res.json().catch(() => ({}));
      entry.status = 'done';
      entry.resultEventId = json.id || entry.resultEventId || null;
      entry.error = null;
    } catch (err) {
      entry.status = 'error';
      entry.error = String(err.message || err);
    }
  }
  await writeJSON(QUEUE, data);
  await recordStatus('calendar', true);
  console.log(`drained ${pending.length} entries`);
}

main().catch(async (err) => {
  await recordStatus('calendar', false, err);
  console.error(err);
  process.exit(1);
});
