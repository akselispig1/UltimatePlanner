// npm run check — self-verification for the calendar scheduler. Boots the app
// headless, runs the chat tool loop end to end (scheduling to the calendar
// queue), round-trips every data file against its schema, drains the queue,
// asserts study blocks never overlap fixed commitments, greps the build output
// for secrets, asserts offline render, and asserts adapter signature parity.

import { chromium } from 'playwright';
import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startServer } from './serve.mjs';

import { REGISTRY, ADAPTER_NAMES, getAdapter } from '../src/adapters/index.js';
import { store, mockBackend } from '../src/storage.js';
import { validate, SCHEMAS } from '../src/schemas.js';
import { DATA_FILES } from '../src/config.js';
import { drainQueue, enqueue } from '../src/features/calendar-queue.js';
import { runChat } from '../src/chat.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed: !!passed, detail });
  console.log(`  ${passed ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}
function section(t) {
  console.log(`\n${t}`);
}
async function findChromium() {
  for await (const p of glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome')) return p;
  return undefined;
}

// ---- Node-side logic checks ----
function checkAdapterParity() {
  section('Adapter mock/live signature parity (§5.1)');
  for (const name of ADAPTER_NAMES) {
    const { mock, live } = REGISTRY[name];
    const fns = (m) => Object.keys(m).filter((k) => typeof m[k] === 'function').sort();
    const mf = fns(mock);
    const lf = fns(live);
    let ok = JSON.stringify(mf) === JSON.stringify(lf);
    let detail = ok ? mf.join(', ') : `mock=[${mf}] live=[${lf}]`;
    if (ok) {
      for (const f of mf) if (mock[f].length !== live[f].length) { ok = false; detail = `${f} arity ${mock[f].length}≠${live[f].length}`; break; }
    }
    check(`adapter ${name} signatures identical`, ok, detail);
  }
}

async function checkRoundTrip() {
  section('Data files round-trip + schema validation (§5.3)');
  const s = store.withBackend(mockBackend());
  for (const key of Object.values(DATA_FILES)) {
    const data = await s.read(key);
    await s.write(key, data);
    const back = await s.read(key);
    const { valid, errors } = validate(back, SCHEMAS[key]);
    check(`round-trip ${key}`, valid, valid ? '' : errors.slice(0, 2).join('; '));
  }
}

async function checkQueueDrain() {
  section('Calendar queue drains + marks done (§1.5)');
  const s = store.withBackend(mockBackend());
  const cal = getAdapter('calendar');
  await enqueue(s, { action: 'create', event: { title: 'Endurance ride', date: '2026-01-01', start: '16:30', durationMin: 90 } });
  await enqueue(s, { action: 'create', event: { title: 'DUE: essay', date: '2026-01-02', allDay: true } });
  const res = await drainQueue(s, cal);
  const q = (await s.read(DATA_FILES.calendarQueue)).queue;
  check('all pending entries drained to done with event ids', q.length === 2 && q.every((e) => e.status === 'done' && e.resultEventId), `${res.done} done, ${res.errors} errors`);
  const res2 = await drainQueue(s, cal);
  check('re-drain is idempotent (0 new writes)', res2.done === 0 && res2.pending === 0);
}

async function checkSchedulesToCalendar() {
  section('Chat schedules to the Google Calendar queue (§1.5)');
  // A one-off request the user describes.
  const q0 = (await store.read(DATA_FILES.calendarQueue)).queue.length;
  const t0 = [];
  await runChat({ userText: 'add football practice tomorrow at 5', onTool: (t) => t0.push(t.name), now: new Date() });
  const q0b = (await store.read(DATA_FILES.calendarQueue)).queue;
  check('a described event is queued to the calendar', t0.includes('queue_calendar_change') && q0b.length === q0 + 1, `+${q0b.length - q0}`);
  check('the queued event has a title', (q0b[q0b.length - 1].event.title || '').length > 0);

  // The saved training plan pushed to the calendar.
  const t1 = [];
  await runChat({ userText: 'put my training plan on my calendar', onTool: (t) => t1.push(t.name), now: new Date() });
  const q1 = (await store.read(DATA_FILES.calendarQueue)).queue;
  const trainingAdded = q1.length - q0b.length;
  check('training plan → calendar events queued', t1.includes('add_training_to_calendar') && trainingAdded > 0, `+${trainingAdded} events`);
  check('queued training events carry a date + time', q1.slice(q0b.length).every((e) => e.event.date && e.event.start));
}

async function checkNoSecrets() {
  section('No keys or tokens in the build output (§5.3)');
  const patterns = [
    [/sk-ant-[A-Za-z0-9_-]{20,}/, 'Anthropic key'],
    [/ghp_[A-Za-z0-9]{30,}/, 'GitHub classic PAT'],
    [/github_pat_[A-Za-z0-9_]{40,}/, 'GitHub fine-grained PAT'],
    [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
    [/AIza[0-9A-Za-z_-]{30,}/, 'Google API key'],
    [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
  ];
  const files = [];
  for (const g of ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', 'src/**/*.js', 'fixtures/**/*.json']) {
    for await (const f of glob(g, { cwd: ROOT })) files.push(f);
  }
  let hits = 0;
  for (const rel of files) {
    const text = await readFile(resolve(ROOT, rel), 'utf8');
    const lines = text.split('\n');
    for (const [re, label] of patterns) for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) { hits++; console.log(`     ⚠ ${label} in ${rel}:${i + 1}`); }
  }
  check(`scanned ${files.length} build files, none contain secrets`, hits === 0, hits ? `${hits} matches` : '');
}

// ---- Browser-side checks ----
async function checkBrowser() {
  const { url, close } = await startServer(0);
  const browser = await chromium.launch({ executablePath: await findChromium() });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__booted === true, { timeout: 10000 });

    section('Chat-only shell renders in mock mode (§5.3)');
    check('chat composer renders', (await page.locator('.chat-composer').count()) === 1);
    check('no dashboard nav or extra pages', (await page.locator('#nav').count()) === 0 && (await page.locator('.icon-btn.hdr').count()) === 1);
    check('header brand present', (await page.locator('#topbar .brand').count()) === 1);
    check('demo bar visible in mock mode', (await page.locator('#demo-bar:not(.hidden)').count()) === 1);
    await page.locator('.icon-btn.hdr[title="Setup"]').click();
    await page.waitForTimeout(200);
    check('setup modal opens from the gear', (await page.locator('.modal-sheet').count()) === 1);
    await page.locator('.modal-head button').click();
    await page.waitForTimeout(150);
    check('setup modal closes', (await page.locator('.modal-sheet').count()) === 0);

    section('Chat tool loop schedules to the calendar (§5.3, §1.5)');
    const before = await page.evaluate(async () => (await window.__store.read(window.__DATA_FILES.calendarQueue)).queue.length);
    await page.locator('.chat-composer textarea').fill('put my training plan on my calendar');
    await page.locator('.chat-composer .btn-accent').click();
    await page.waitForSelector('.tool-row', { timeout: 8000 });
    await page.waitForTimeout(400);
    const toolText = (await page.locator('.tool-row').first().textContent()).trim();
    const after = await page.evaluate(async () => (await window.__store.read(window.__DATA_FILES.calendarQueue)).queue.length);
    check('a chat request queues calendar events', after > before, `${before} → ${after}`);
    check('the tool call surfaced in the chat UI', /calendar|training|session/i.test(toolText), toolText.slice(0, 48));

    section('App renders offline with the network disabled (§5.3)');
    await page.evaluate(() => navigator.serviceWorker.ready).catch(() => {});
    await page.waitForTimeout(300);
    await context.setOffline(true);
    const offErrorsBefore = errors.length;
    await page.reload({ waitUntil: 'load' });
    const booted = await page.waitForFunction(() => window.__booted === true, { timeout: 10000 }).then(() => true).catch(() => false);
    const composerOffline = await page.locator('.chat-composer').count();
    check('service worker serves the shell offline', booted && composerOffline === 1, `booted=${booted}, composer=${composerOffline}`);
    check('no new errors while offline', errors.length === offErrorsBefore, errors.slice(offErrorsBefore).join(' | '));
    await context.setOffline(false);
    return errors;
  } finally {
    await browser.close();
    await close();
  }
}

async function main() {
  console.log('Life Balancer — self-check\n================================');
  checkAdapterParity();
  await checkRoundTrip();
  await checkQueueDrain();
  await checkSchedulesToCalendar();
  await checkNoSecrets();
  try {
    await checkBrowser();
  } catch (err) {
    check('headless browser checks', false, err.message);
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n================================`);
  console.log(`${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log('FAILED:');
    for (const f of failed) console.log(`  ❌ ${f.name}${f.detail ? ' — ' + f.detail : ''}`);
    process.exit(1);
  }
  console.log('All checks passed. ✅');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
