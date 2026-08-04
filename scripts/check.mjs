// npm run check — self-verification (§5.3). Boots the app headless, runs the
// chat tool loop end to end, round-trips every data file against its schema,
// drains the calendar queue, asserts study blocks never overlap fixed
// commitments, greps the build output for secrets, asserts offline render, and
// asserts adapter mock/live signature parity. Exits non-zero on any failure.

import { chromium } from 'playwright';
import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startServer } from './serve.mjs';

// modules under test (Node-side)
import { REGISTRY, ADAPTER_NAMES, getAdapter } from '../src/adapters/index.js';
import { store, mockBackend } from '../src/storage.js';
import { validate, SCHEMAS } from '../src/schemas.js';
import { DATA_FILES } from '../src/config.js';
import { seedFor } from '../src/seed.js';
import { generateStudyBlocks } from '../src/features/school.js';
import { fixedCommitments, overlaps } from '../src/features/schedule.js';
import { drainQueue, enqueue } from '../src/features/calendar-queue.js';
import { runChat } from '../src/chat.js';
import { FORBIDDEN_FUELLING, dailyFuelling } from '../src/features/nutrition.js';
import * as fx from '../src/fixtures.js';

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
  return undefined; // fall back to Playwright's default resolution
}

// ---------------------------------------------------------------------------
// Node-side logic checks
// ---------------------------------------------------------------------------
function checkAdapterParity() {
  section('Adapter mock/live signature parity (§5.3)');
  for (const name of ADAPTER_NAMES) {
    const { mock, live } = REGISTRY[name];
    const fns = (m) => Object.keys(m).filter((k) => typeof m[k] === 'function').sort();
    const mf = fns(mock);
    const lf = fns(live);
    let ok = JSON.stringify(mf) === JSON.stringify(lf);
    let detail = ok ? mf.join(', ') : `mock=[${mf}] live=[${lf}]`;
    if (ok) {
      for (const f of mf) {
        if (mock[f].length !== live[f].length) {
          ok = false;
          detail = `${f} arity ${mock[f].length}≠${live[f].length}`;
          break;
        }
      }
    }
    check(`adapter ${name} signatures identical`, ok, detail);
  }
}

async function checkRoundTrip() {
  section('Data files round-trip + schema validation (§5.3)');
  const s = store.withBackend(mockBackend());
  for (const key of Object.values(DATA_FILES)) {
    const data = await s.read(key); // seeds
    await s.write(key, data);
    const back = await s.read(key);
    const { valid, errors } = validate(back, SCHEMAS[key]);
    check(`round-trip ${key}`, valid, valid ? '' : errors.slice(0, 2).join('; '));
  }
}

async function checkQueueDrain() {
  section('Calendar queue drains + marks done (§5.3)');
  const s = store.withBackend(mockBackend());
  const cal = getAdapter('calendar'); // mock in demo mode
  await enqueue(s, { action: 'create', event: { title: 'Endurance ride', date: '2026-01-01', start: '16:30', durationMin: 90 } });
  await enqueue(s, { action: 'create', event: { title: 'DUE: essay', date: '2026-01-02', allDay: true } });
  const res = await drainQueue(s, cal);
  const q = (await s.read(DATA_FILES.calendarQueue)).queue;
  const allDone = q.length === 2 && q.every((e) => e.status === 'done' && e.resultEventId);
  check('all pending entries drained to done with event ids', allDone, `${res.done} done, ${res.errors} errors`);
  // Idempotent: re-draining does nothing new.
  const res2 = await drainQueue(s, cal);
  check('re-drain is idempotent (0 new writes)', res2.done === 0 && res2.pending === 0);
}

function checkStudyOverlap() {
  section('Study blocks never overlap fixed commitments (§5.3)');
  const now = new Date();
  const assignments = fx.assignments(now);
  const plan = fx.trainingPlan();
  const externalCal = fx.externalCalendar(now).filter((e) => e.kind === 'trip');
  const social = [{ id: 's1', what: 'Cinema', when: `${offset(now, 2)}T19:30`, status: 'confirmed' }];
  const blocks = generateStudyBlocks({ assignments, plan, externalCal, social, now });
  let overlaps_found = 0;
  let selfOverlap = 0;
  const byDate = {};
  for (const b of blocks) {
    const bi = intervalOf(b);
    for (const f of fixedCommitments(b.date, { plan, externalCal, social })) {
      if (overlaps(bi, f)) overlaps_found++;
    }
    (byDate[b.date] ||= []).forEach((other) => {
      if (overlaps(bi, other)) selfOverlap++;
    });
    (byDate[b.date] ||= []).push(bi);
  }
  check('generated at least one study block', blocks.length > 0, `${blocks.length} blocks`);
  check('no study block overlaps a fixed commitment', overlaps_found === 0, `${overlaps_found} overlaps`);
  check('no two study blocks overlap each other', selfOverlap === 0, `${selfOverlap} overlaps`);
}

async function checkPlans() {
  section('Goal-linked plans built via chat (training + fuelling)');
  const before = await store.read(DATA_FILES.plans);
  // Ask the chatbot to build a sophisticated training plan.
  const t = [];
  await runChat({ userText: 'build me a more sophisticated training plan for my goal', onTool: (x) => t.push(x.name), now: new Date() });
  const afterT = await store.read(DATA_FILES.plans);
  const block = afterT.trainingBlocks.find((b) => b.goalId === 'goal-2') || afterT.trainingBlocks[afterT.trainingBlocks.length - 1];
  check('set_training_block ran from chat', t.includes('set_training_block'), t.join(','));
  check('training block is multi-week and progressive', !!block && block.weeks.length >= 3 && block.weeks[block.weeks.length - 1].focus.toLowerCase().includes('taper'), block ? `${block.weeks.length} weeks` : 'none');

  // Ask for a "diet plan" — must be saved as a safe fuelling plan.
  const f = [];
  await runChat({ userText: 'can you make me a diet plan', onTool: (x) => f.push(x.name), now: new Date() });
  const afterF = await store.read(DATA_FILES.plans);
  check('set_fuelling_plan ran from chat (diet request reframed)', f.includes('set_fuelling_plan'), f.join(','));
  const fuelText = JSON.stringify(afterF.fuellingPlans).toLowerCase();
  const bad = FORBIDDEN_FUELLING.filter((w) => fuelText.includes(w));
  check('fuelling plan contains no calorie/goal-weight/restriction language (§3.5)', bad.length === 0, bad.length ? bad.join(', ') : '');
  check('fuelling plan has real guidance', afterF.fuellingPlans.length > 0 && (afterF.fuellingPlans[0].days || []).length > 0);
}

async function checkNutrition() {
  section('Meal photo → advice logged to the Food page (§3.5)');
  const png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const before = (await store.read(DATA_FILES.logs)).entries.filter((e) => e.kind === 'nutrition').length;
  await runChat({ userText: '', image: { mediaType: 'image/png', dataBase64: png1x1 }, now: new Date() });
  const entries = (await store.read(DATA_FILES.logs)).entries.filter((e) => e.kind === 'nutrition');
  check('sending a meal photo logs a nutrition note', entries.length === before + 1, `${before} → ${entries.length}`);
  const last = entries[entries.length - 1] || {};
  const bad = FORBIDDEN_FUELLING.filter((w) => (last.text || '').toLowerCase().includes(w));
  check('the logged note is adequacy-framed (no restriction language)', bad.length === 0, bad.join(', '));

  // "Today's fuelling" is computed from real training + sleep, on any weekday,
  // and must never contain restriction language.
  section("Today's fuelling is data-driven and §3.5-safe");
  const plan = fx.trainingPlan();
  const sleepData = fx.sleep();
  let anyForbidden = [];
  let allHaveDetail = true;
  for (let off = 0; off < 7; off++) {
    const at = new Date();
    at.setDate(at.getDate() + off);
    const f = dailyFuelling({ plan, sleep: sleepData, now: at });
    const text = `${f.title} ${f.detail} ${f.tomorrowCue || ''}`.toLowerCase();
    anyForbidden = anyForbidden.concat(FORBIDDEN_FUELLING.filter((w) => text.includes(w)));
    if (!f.title || !f.detail) allHaveDetail = false;
  }
  check("every day produces a fuelling suggestion with real detail", allHaveDetail);
  check("no day's fuelling contains calorie/goal-weight/restriction language", anyForbidden.length === 0, [...new Set(anyForbidden)].join(', '));
}

function intervalOf(b) {
  const [h, m] = b.start.split(':').map(Number);
  return { start: h * 60 + m, end: h * 60 + m + b.durationMin };
}
function offset(now, n) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  // The deployable build output only (not scripts/node_modules/.git).
  const files = [];
  for (const g of ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', 'src/**/*.js', 'fixtures/**/*.json']) {
    for await (const f of glob(g, { cwd: ROOT })) files.push(f);
  }
  let hits = 0;
  for (const rel of files) {
    const text = await readFile(resolve(ROOT, rel), 'utf8');
    const lines = text.split('\n');
    for (const [re, label] of patterns) {
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) {
          hits++;
          console.log(`     ⚠ ${label} in ${rel}:${i + 1}`);
        }
      }
    }
  }
  check(`scanned ${files.length} build files, none contain secrets`, hits === 0, hits ? `${hits} matches` : '');
}

// ---------------------------------------------------------------------------
// Browser-side checks
// ---------------------------------------------------------------------------
async function checkBrowser() {
  const { url, close } = await startServer(0);
  const browser = await chromium.launch({ executablePath: await findChromium() });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__booted === true, { timeout: 10000 });

    section('Chat-only shell renders in mock mode (§5.3)');
    check('chat composer renders', (await page.locator('.chat-composer').count()) === 1);
    check('no dashboard nav (chat-only)', (await page.locator('#nav').count()) === 0);
    check('header brand present', (await page.locator('#topbar .brand').count()) === 1);
    check('demo bar visible in mock mode', (await page.locator('#demo-bar:not(.hidden)').count()) === 1);
    // Setup is reachable via the gear (§1.4).
    await page.locator('.icon-btn.hdr[title="Setup"]').click();
    await page.waitForTimeout(200);
    check('setup modal opens from the gear', (await page.locator('.modal-sheet').count()) === 1);
    await page.locator('.modal-head button').click();
    await page.waitForTimeout(150);
    check('setup modal closes', (await page.locator('.modal-sheet').count()) === 0);

    section('Chat tool loop end to end (§5.3)');
    const activeBefore = await page.evaluate(async () => (await window.__store.read(window.__DATA_FILES.goals)).goals.filter((g) => g.status === 'active').length);
    await page.locator('.chat-composer textarea').fill('please set a goal to stay consistent');
    await page.locator('.chat-composer .btn-accent').click();
    await page.waitForSelector('.tool-row', { timeout: 8000 });
    await page.waitForTimeout(400);
    const toolText = (await page.locator('.tool-row', { hasText: 'goal' }).first().textContent()).trim();
    const activeAfter = await page.evaluate(async () => (await window.__store.read(window.__DATA_FILES.goals)).goals.filter((g) => g.status === 'active').length);
    check('set_goal tool ran and wrote goals.json (§5.3 data reflects it)', activeAfter === activeBefore + 1, `${activeBefore} → ${activeAfter}`);
    check('tool call surfaced in chat UI', /goal/i.test(toolText), toolText.slice(0, 48));

    section('Food & fuelling page (§3.5 — not on the calendar)');
    await page.locator('.icon-btn.hdr').first().click(); // food toggle
    await page.waitForTimeout(200);
    check('Food page opens from the header', (await page.locator('#view', { hasText: 'Food & fuelling' }).count()) > 0);
    check("Food page leads with today's fuelling", (await page.locator('.fuel-today').count()) === 1);
    check('Food page shows the fuelling plan', (await page.locator('#view', { hasText: 'Fuelling plan' }).count()) > 0);
    check('Food page shows the weight trend', (await page.locator('#view', { hasText: '30-day trend' }).count()) > 0);
    // Meal advice notes surface here (the photo→note flow is proven in Node below).
    const nutritionNotes = await page.evaluate(async () => (await window.__store.read(window.__DATA_FILES.logs)).entries.filter((e) => e.kind === 'nutrition').length);
    check('Food page lists meal advice notes', nutritionNotes > 0, `${nutritionNotes} notes`);
    await page.locator('.icon-btn.hdr').first().click(); // back to chat
    await page.waitForTimeout(150);
    check('header toggles back to chat', (await page.locator('.chat-composer').count()) === 1);

    section('In-chat plan confirmation → Google Calendar queue (§3.3, §1.5)');
    const cards = await page.locator('.confirm-card').count();
    check('pending plans surface as inline confirm cards', cards > 0, `${cards} cards`);
    const qBefore = await page.evaluate(async () => (await window.__store.read(window.__DATA_FILES.calendarQueue)).queue.length);
    await page.locator('.confirm-card .btn-accent').first().click();
    await page.waitForTimeout(300);
    const qAfter = await page.evaluate(async () => (await window.__store.read(window.__DATA_FILES.calendarQueue)).queue.length);
    check('confirming a plan queues a calendar event', qAfter === qBefore + 1, `${qBefore} → ${qAfter}`);

    section('App renders offline with the network disabled (§5.3)');
    await page.evaluate(() => navigator.serviceWorker.ready).catch(() => {});
    await page.waitForTimeout(300); // let precache settle
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

// ---------------------------------------------------------------------------
async function main() {
  console.log('Life Balancer — self-check (§5.3)\n================================');
  checkAdapterParity();
  await checkRoundTrip();
  await checkQueueDrain();
  checkStudyOverlap();
  await checkPlans();
  await checkNutrition();
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
