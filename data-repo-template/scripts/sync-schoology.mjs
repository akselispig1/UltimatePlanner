// Pull Schoology assignments + trip events → data/schoology.json (§3.2). Uses
// two-legged OAuth 1.0 request signing (HMAC-SHA1) — done here in Actions, never
// the browser. If your school disabled personal API keys, skip this workflow and
// enter assignments manually in the app.
import { createHmac, randomBytes } from 'node:crypto';
import { readJSON, writeJSON, recordStatus } from './lib.mjs';

const KEY = process.env.SCHOOLOGY_KEY;
const SECRET = process.env.SCHOOLOGY_SECRET;
const BASE = process.env.SCHOOLOGY_BASE || 'https://api.schoology.com/v1';
const OUT = 'data/schoology.json';

function oauthHeader(method, url) {
  const params = {
    oauth_consumer_key: KEY,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
  };
  const enc = encodeURIComponent;
  const paramStr = Object.keys(params).sort().map((k) => `${enc(k)}=${enc(params[k])}`).join('&');
  const base = [method.toUpperCase(), enc(url.split('?')[0]), enc(paramStr)].join('&');
  const signature = createHmac('sha1', `${enc(SECRET)}&`).update(base).digest('base64');
  const all = { ...params, oauth_signature: signature };
  return 'OAuth ' + Object.keys(all).map((k) => `${enc(k)}="${enc(all[k])}"`).join(', ');
}

async function api(path) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { headers: { Authorization: oauthHeader('GET', url), Accept: 'application/json' } });
  if (!res.ok) throw new Error(`schoology ${path} ${res.status}`);
  return res.json();
}

async function main() {
  if (!KEY || !SECRET) throw new Error('SCHOOLOGY_KEY/SECRET not set');
  // Endpoints differ per deployment; adjust to your school's sections.
  const me = await api('/users/me');
  const sections = await api(`/users/${me.uid}/sections`);
  const assignments = [];
  const trips = [];
  for (const sec of sections.section || []) {
    const grades = await api(`/sections/${sec.id}/grade_items`).catch(() => ({}));
    for (const g of grades.grade_item || []) {
      assignments.push({
        id: `sch-${g.id}`,
        title: g.title,
        course: sec.course_title || sec.section_title,
        due: (g.due || '').slice(0, 10) || null,
        weight: Math.round((g.max_points || 10)),
        status: 'open',
        source: 'schoology',
      });
    }
    const events = await api(`/sections/${sec.id}/events`).catch(() => ({}));
    for (const e of events.event || []) {
      if (/trip/i.test(e.title)) trips.push({ id: `sch-ev-${e.id}`, title: e.title, date: (e.start || '').slice(0, 10), allDay: true, kind: 'trip', source: 'schoology' });
    }
  }
  await writeJSON(OUT, { assignments, trips, updatedAt: new Date().toISOString() });
  await recordStatus('schoology', true);
  console.log(`schoology: ${assignments.length} assignments, ${trips.length} trips`);
}

main().catch(async (err) => {
  await recordStatus('schoology', false, err);
  console.error(err);
  process.exit(1);
});
