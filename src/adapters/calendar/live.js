// Calendar adapter — live. Runs inside the Actions drain job (Node), never the
// browser: Google's OAuth refresh token lives in Actions secrets (§1.5). Writes
// to a dedicated "Life Balancer" calendar so it never touches the real one
// destructively (§2). Signature-identical to mock.js.
//
// The token/calendarId come from the environment in the Action.
const GOOGLE = 'https://www.googleapis.com/calendar/v3';

export const NAME = 'calendar';

function cfg() {
  const g = typeof process !== 'undefined' ? process.env : {};
  return { token: g.GOOGLE_ACCESS_TOKEN || '', calendarId: g.GOOGLE_CALENDAR_ID || 'primary' };
}
function headers() {
  return { Authorization: `Bearer ${cfg().token}`, 'Content-Type': 'application/json' };
}

export async function createEvent(event) {
  const res = await fetch(`${GOOGLE}/calendars/${encodeURIComponent(cfg().calendarId)}/events`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`Google create: ${res.status}`);
  const json = await res.json();
  return { id: json.id };
}

export async function updateEvent(id, event) {
  const res = await fetch(`${GOOGLE}/calendars/${encodeURIComponent(cfg().calendarId)}/events/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`Google update: ${res.status}`);
  const json = await res.json();
  return { id: json.id };
}

export async function deleteEvent(id) {
  const res = await fetch(`${GOOGLE}/calendars/${encodeURIComponent(cfg().calendarId)}/events/${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok && res.status !== 410) throw new Error(`Google delete: ${res.status}`);
  return { id, deleted: true };
}

export async function verify() {
  const res = await fetch(`${GOOGLE}/calendars/${encodeURIComponent(cfg().calendarId)}`, { headers: headers() });
  return res.ok;
}
