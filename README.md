# # Life Balancer — Build Spec

A serverless personal life-planning PWA. Frontend on GitHub Pages, "backend" is GitHub Actions.

**How to use this file:** commit it to the repo root, then tell Claude Code:

> Read SPEC.md. Build the core against mock data — I have no API keys connected yet. Everything must run and be verifiable without them. When you're done, run `npm run check` yourself, fix whatever fails, re-run until it passes clean, then report what works and what's still stubbed. Don't ask me to test things you can test yourself.

---

## Running it (the core is built — mock mode)

This repo now contains the built PWA. It runs **fully on realistic demo data with no API keys**.

```bash
npm install     # dev-only: Playwright, used by the check
npm start       # serve at http://localhost:5173
npm run check   # headless self-verification — 26 assertions
```

Open the URL on a phone (or a 390×844 viewport). **The app is a single chatbot with one job: putting things on your Google Calendar.** Tell it your training plan and it schedules the sessions; ask it to add your assignment due dates and study time; or just say "add football practice tomorrow at 5". It streams replies and shows each calendar write as a thin ✓ row. A gear (⚙) opens setup for keys. The amber **DEMO DATA** bar shows until you connect keys.

> Scope note: this started as a five-tab life dashboard (per the spec §4) and was **stripped all the way back** to a calendar scheduler at the owner's direction — no nutrition, goals, weight, recovery, or dashboards. It now does exactly what §1 asked for: the chatbot is the only input, Google Calendar the only output.

- **Connecting real integrations:** [SETUP.md](SETUP.md) — Anthropic (chat) → GitHub PAT (data) → Google Calendar (output) → Schoology (assignments). Each flips its own adapter from mock to live independently.
- **Private data-repo automation:** [data-repo-template/](data-repo-template/) — the scheduled workflows (calendar drain, Schoology pull).
- **Conventions:** [CLAUDE.md](CLAUDE.md).
- **What works vs what's still stubbed:** see [Status](#status--what-works-vs-stubbed) at the bottom.

---

## 0. Non-negotiable constraints

- No server, no VPS, no Vercel/Netlify functions. GitHub Pages + GitHub Actions only.
- No third-party client *secrets* in frontend code, ever (Strava, Google, Schoology). Those live in GitHub Actions secrets.
- The user's own Anthropic API key and GitHub PAT are the exception — see §1.4.
- Google Calendar is the primary output surface. Anything the app decides must end up as a calendar event.
- The chatbot is the primary input surface. Prefer adding a tool to the chatbot over building a new screen.
- Push notifications are **optional, Phase 7**. Do not let them shape earlier architecture.
- Offline-first: last-synced data must render with no network.

---

## 1. Architecture

### Two repositories

**`life-balancer`** (public) — the PWA
- Static HTML/CSS/JS. No build step if avoidable; if a build is needed use Vite and deploy via Actions.
- Contains zero secrets.
- Served at `https://<user>.github.io/life-balancer/`

**`life-balancer-data`** (private) — data + automation
- `/data/*.json` — all synced state
- `/inbox/*` — uploads awaiting processing (food photos, scale photos, WhatsApp text)
- `/.github/workflows/*` — the scheduled jobs
- Secrets stored in repo Settings → Secrets and variables → Actions

### Data flow

```
GitHub Actions (cron)  →  fetch APIs  →  commit JSON to private repo
                                              ↓
PWA on phone  ←──── reads via GitHub Contents API + fine-grained PAT
                                              ↓
PWA writes (photo, manual entry)  →  commits to /inbox/
                                              ↓
Action triggers on push  →  processes  →  commits result  →  sends push
```

### Auth for the phone

On first launch, the app asks for a fine-grained personal access token scoped to `life-balancer-data` only, with Contents: read+write. Store in `localStorage`. Add a "sign out / clear token" button. Document how to generate it in the README.

### 1.4 Keys held on the phone

Two keys are entered once on a setup screen and stored in `localStorage`:

1. **GitHub fine-grained PAT** — scoped to `life-balancer-data` only, Contents read+write.
2. **Anthropic API key** — used by the chatbot to call the API directly from the browser.

Direct browser calls to the Anthropic API require the header `anthropic-dangerous-direct-browser-access: true`.

This is a deliberate trade-off. Routing chat through GitHub Actions would add 30–60s of latency per message, which makes conversation unusable. Since this is a single-user app running on the owner's own device, holding the key locally is acceptable. Requirements:

- Both keys entered on a setup screen, never hardcoded, never committed.
- **The app must run fully with no keys entered**, using mock adapters (§5.1). Never block the UI behind a setup wall.
- A "clear all keys" button in settings that wipes `localStorage` and unregisters the service worker.
- The setup screen states plainly what each key can access, and shows connected/not-connected status per integration.
- Never log key values to console.

### 1.5 Calendar writes

The chatbot and the nightly Balancer do **not** call Google directly (Google's OAuth refresh tokens don't belong in a browser). They append intents to `/data/calendar-queue.json`:

```json
{ "id": "uuid", "action": "create|update|delete", "event": {...}, "status": "pending" }
```

A workflow runs every 15 minutes, drains the queue, writes to Google Calendar, and marks entries `done` with the resulting event ID. The UI shows queued items as pending so nothing looks lost.

### 1.6 Actions cron caveats

- Cron can fire 5–20 minutes late under load. Nothing may depend on precise timing.
- Scheduled workflows auto-disable after 60 days of no repo activity. Have workflows commit using a PAT rather than `GITHUB_TOKEN` so their own commits count as activity.

---

## 2. Integrations — feasibility and approach

| Source | Status | Approach |
|---|---|---|
| **Strava** | Works | OAuth once locally, store refresh token as Actions secret. Poll `/athlete/activities` every 30 min. Webhooks need a public callback URL, so poll instead. |
| **Google Calendar** | Works | Same pattern. Actions writes events with a service account or stored refresh token. Use a dedicated "Life Balancer" calendar so it never touches your real one destructively. |
| **Schoology** | Check first | Users can often generate their own API key + secret at `schoology.com/api` — but ISZL may have disabled this. **Verify before building.** Uses OAuth 1.0 request signing; do it in Actions, never in browser. If blocked, fall back to manual assignment entry. |
| **Garmin** | Hard | The Garmin Health API requires partner program approval, which is unrealistic for a solo project. **Use this instead:** an iOS Shortcut reads sleep from Apple Health (Garmin syncs into it) on a daily automation and POSTs JSON to the GitHub Contents API. Build the Shortcut as part of Phase 4. |
| **WhatsApp** | No API | There is no legitimate personal API for reading your chats. **Use this instead:** iOS Share Sheet → Shortcut → appends the shared message text to `/inbox/whatsapp/`. An Action then parses it with the Anthropic API to extract plans (who / what / when / where). You share a message manually when plans get made. |
| **Food + scale photos** | Works | Sent directly in the chat. Browser compresses to max 1600px / ~1MB, base64, straight to the Anthropic API with vision. Instant. The chatbot writes any structured result to `/data/` via its tools. No inbox folder, no workflow. |

Do not fake any of these. If an integration can't be reached, the UI shows a clear "not connected" state rather than placeholder data.

---

## 3. Features

### 3.1 Training
- Weekly plan stored in `/data/training-plan.json`. Sessions have type, duration, target intensity, day.
- Every planned session becomes a calendar event with type, duration and intensity in the description.
- Strava sync marks sessions complete by matching date + activity type + rough duration, and appends the actual result to the calendar event description (`✓ 47min, 620m climbing`).
- Rolling 7-day and 28-day load view.
- If a session is missed, do not automatically stack it onto another day. Flag it in the app and let the chatbot offer a reschedule.

### 3.2 School (Schoology)
- Pull assignments, due dates, and any calendar events tagged as trips.
- Generate study blocks: work backwards from due date, size the block by assignment weight, place it in free calendar time.
- Study blocks and due dates both become calendar events. Due dates are all-day events prefixed `DUE:`.
- Trips become all-day calendar events, created as soon as they appear in Schoology.

### 3.3 Social
- Parsed WhatsApp plans land in a review queue — you confirm or discard before anything is scheduled. Never auto-commit a parsed plan to the calendar.
- Confirmed plans become calendar events and become fixed blocks that training and study schedule *around*.

### 3.4 Recovery
- Sleep duration, sleep score, resting HR from the Health shortcut.
- If sleep is poor two nights running, suggest downgrading the next hard session. Suggest — don't silently rewrite the plan.

### 3.5 Nutrition — read this section carefully

The user is 14 and still growing. This feature exists to support fuelling for sport and school, not to restrict.

**What it should actually do.** Send a photo in chat, get back:
- What's on the plate, plainly.
- Whether it fits what today needs — a big ride day needs more carbs than a rest day, and it should say so using the actual training data it has.
- One specific, easy addition or swap. "Add a yoghurt" beats a paragraph of theory.
- If you ask "what should I eat", it answers with real food you'd plausibly have, factoring in tomorrow's session and last night's sleep.

Weight from scale photos: read the number, log it, show a 30-day trend line. That's the whole feature.

**Required behaviour:**
- Frame all feedback around adequacy and performance: "you'll want more carbs before tomorrow's ride", "add a protein source here".
- Do **not** display calorie targets, calorie deficits, or macro percentage goals.
- Do **not** set, suggest, or track a goal weight. Scale photos log a number and a trend line, nothing more.
- Do **not** rank foods as good/bad, or use language like "cheat meal", "earned", or "burn off".
- Never link food intake to exercise output in the same view or sentence.
- If input suggests skipped meals or restriction, the app surfaces a gentle prompt to talk to a parent or coach — not a plan adjustment.

Put these rules in the system prompt for the Anthropic API call verbatim, and in `CLAUDE.md` so they survive future edits.

### 3.6 Chat — the main interface

A full-screen conversation view. This is where goals get set, photos get sent, and data gets discussed. It replaces most settings screens.

**Context:** every message sends a compact JSON snapshot of current state — active goals, last 14 days of training with completion status, last 7 nights of sleep, recent nutrition notes, weight trend, open assignments and due dates, upcoming calendar week. Keep it under ~4k tokens; summarise older data rather than truncating it. Never send raw API dumps.

**Tools the chatbot has:**

| Tool | Does |
|---|---|
| `get_history` | Pull a wider date range than the default snapshot |
| `set_goal` | Create or update a goal in `/data/goals.json` |
| `adjust_training_plan` | Modify sessions in `/data/training-plan.json` |
| `log_entry` | Write a nutrition, weight, or subjective note |
| `queue_calendar_change` | Append to the calendar queue (§1.5) |
| `create_study_block` | Schedule study time against a specific assignment |

**Rules:**
- Any tool that writes must state what it changed in plain language afterwards.
- Changes to the training plan or goals require explicit confirmation in the conversation first. Never silently rewrite the week.
- Conversation history persists to `/data/chat/YYYY-MM.json`. Load the last 20 messages on open.
- Streaming responses. Show a typing indicator during tool calls.
- If the Anthropic key is missing or rejected, say so clearly and link to the setup screen — never fail silently.

**System prompt must include:** the nutrition rules from §3.5 verbatim, the user's age, that they're a mountain biker and student, and an instruction to be direct and brief rather than write essays.

**Goals** live in `/data/goals.json` — each has a title, type (performance / consistency / school / recovery), target, deadline, and progress derived from real synced data. The chatbot can create, edit, or retire them, but progress is always computed from Strava/Garmin/Schoology data, never asserted by the model.

### 3.7 The Balancer
Nightly job that composes tomorrow: fixed commitments (school, confirmed social) → training slot → study blocks in remaining gaps → writes to Google Calendar → morning push with the day's summary.

Conflict rule when time is short: school deadlines > confirmed social > training > optional study.

---

## 4. Design — Garmin Connect style

- **Dark:** background `#000000`, cards `#1C1C1E`, borders `#2C2C2E`.
- **Accent:** Garmin blue `#00A9E0`. Secondary teal `#00D4AA`. Warning amber `#FFB800`. Never red for anything health-related.
- **Type:** heavy weight, tight tracking. Big numbers are the interface — metric value at 40–56px, label above at 11px uppercase letter-spaced grey.
- **Cards:** 16px radius, 16px padding, 12px gaps, full-bleed to 16px screen margins.
- **Rings/arcs:** SVG donuts for daily completion. 8px stroke, rounded caps, grey track underneath.
- **Nav:** bottom tab bar, 5 items, icon + tiny label. Today / Training / School / **Chat** / Me. Chat sits centre and is visually emphasised — it's the main way in.
- **Chat bubbles:** user right-aligned in accent blue, assistant left-aligned on `#1C1C1E`. Tool calls render as a thin grey inline row (`✓ Updated Thursday's session`), not as bubbles.
- **Motion:** minimal. Fade and slide-up only, 200ms ease-out. No bounce.
- Respect safe-area insets. Test at 390×844.

---

## 5. Build order and self-verification

**Build the whole core against mock data first. No API keys required to run it.**

### 5.1 The adapter rule

Every external service sits behind an adapter with two implementations:

```
/src/adapters/strava/    → mock.js  |  live.js
/src/adapters/anthropic/ → mock.js  |  live.js
/src/adapters/calendar/  → mock.js  |  live.js
/src/adapters/health/    → mock.js  |  live.js
/src/adapters/schoology/ → mock.js  |  live.js
```

Selection is automatic: if the relevant key is present in `localStorage` or Actions secrets, use `live`. If not, use `mock`. Never a code change — only a key appearing.

Mocks return realistic fixture data committed to `/fixtures/`: 6 weeks of plausible rides and gym sessions with gaps and missed days, 6 weeks of sleep with a couple of bad nights, a dozen assignments at varying urgency, a weight series with normal daily noise, and canned chat responses including tool calls.

Mock mode shows a persistent amber bar: **DEMO DATA — no keys connected**.

### 5.2 Build the core

Everything below must work fully in mock mode:

- PWA shell — manifest, service worker, offline, home-screen install, dark Garmin styling
- Bottom nav and all five views rendering real fixture data
- Chat — conversation UI, streaming, photo attach and compress, history persistence, full tool-use loop
- All six chat tools, actually reading and writing JSON
- Goals — create, edit, retire, progress computed from data
- Training plan — CRUD, completion matching against activity data, load charts
- Calendar queue — intents written, drain job runs, mock calendar records the write
- Study block generation from assignments
- Setup screen with per-integration status: *connected / not connected*
- Nutrition rules enforced in the system prompt

### 5.3 Self-verification

Write `npm run check` and run it yourself before reporting done. It must:

- Boot the app headless and assert every view renders without error in mock mode
- Run the full chat tool loop end to end against the mock — send a message, trigger `set_goal`, confirm `goals.json` changed, confirm the UI reflects it
- Round-trip every data file: write, read back, validate against its schema
- Assert `calendar-queue.json` drains correctly and marks entries done
- Assert study blocks never overlap fixed commitments
- Grep the entire build output for anything resembling a key or token and fail if found
- Assert the app renders offline with the network disabled
- Assert every adapter's mock and live implementation export identical function signatures

Then verify manually and report:
- Installs to iOS home screen and opens standalone
- Renders correctly at 390×844 with safe-area insets respected
- Kill the network mid-session — app still works, queued writes retry on reconnect
- Every failure state has a visible message, never a blank screen or silent catch

Fix what fails. Re-run. Only report done when it passes clean.

### 5.4 Then keys go in

Produce `SETUP.md` with a section per integration, each containing: exactly where to click to get the credential, exactly which secret name or setup-screen field it goes into, and a one-line test to confirm it works.

Order to connect them in, easiest first:

1. **Anthropic key** — paste into setup screen. Chat goes live immediately.
2. **GitHub PAT** — data persists to the private repo.
3. **Google Calendar** — run the OAuth script, refresh token into Actions secrets.
4. **Strava** — same pattern.
5. **Apple Health** — install the Shortcut for sleep.
6. **Schoology** — check `schoology.com/api` grants a key first; if ISZL blocks it, stay on manual entry.

Each one flips its adapter from mock to live independently. Connecting one must never break the others. When all are live the amber demo bar disappears on its own.

### 5.5 Optional, only if wanted later

Push notifications — VAPID keys, subscribe flow, scheduled reminders. The calendar may well be enough.

---

## 6. Repo conventions

- Plain JS + ES modules preferred over a framework. If state gets complex, Preact — not React.
- Mock and live adapters must stay signature-identical. If you add a method to one, add it to the other in the same commit.
- Fixtures must be realistic, not perfect — include missed sessions, bad nights, late assignments. A UI that only looks right on ideal data is not finished.
- Every workflow must be idempotent and safe to re-run.
- Every API call wrapped with retry + a written error state in `/data/sync-status.json`. The app shows last-sync time per integration.
- Commit setup instructions to `README.md` as you go: how to get each token, where each secret goes.
- Never commit tokens, `.env`, or raw API responses containing personal data beyond what's needed.

---

## Status — what works vs stubbed

The app was **stripped back to a calendar scheduler** at the owner's direction — the nutrition/fuelling, goals, weight, recovery, Strava and dashboard features described elsewhere in this spec were removed. What remains:

**Works today, fully verifiable in mock mode (`npm run check` — 26/26 passing):**

- **Single-chatbot PWA shell** — one full-screen conversation, a header with a setup gear, no other pages; manifest, service worker, **offline render**, home-screen install metadata, dark styling, safe-area insets, 390×844.
- **Chat** — streaming, typing indicator, persisted history, and the **full tool-use loop**; a greeting that explains what it does.
- **Five calendar tools**, each reading/writing real JSON and stating what it scheduled: `adjust_training_plan`, `add_training_to_calendar`, `add_assignments_to_calendar`, `create_study_block`, `queue_calendar_change`.
- **Training plan → calendar** — "put my training plan on my calendar" queues the week's sessions as dated events.
- **Assignments → calendar** — "add my assignments" pulls open Schoology assignments and queues their DUE dates, optionally with **study blocks** placed in free time and proven never to overlap fixed commitments.
- **One-off requests → calendar** — "add football practice tomorrow at 5" queues a single event.
- **Google Calendar as the only output** — every decision becomes a queued intent; the drain marks entries `done` (idempotent).
- **Setup (gear → modal)** — per-integration connected/not-connected status; key entry (never displayed/logged); clear-all wipes keys + unregisters the SW.
- Adapters (schoology, calendar, anthropic): signature-identical `mock.js`/`live.js`; selection automatic on a key appearing.

**Stubbed / awaiting real credentials (unverifiable here, templated for when keys go in):**

- Live API calls — the `live.js` adapters and the `data-repo-template/` scripts (Google Calendar drain, Schoology pull, their OAuth) are written but need real secrets to exercise. One-off OAuth helper scripts are provided.
- Push notifications — Phase 7, intentionally not built (§5.5).
- Manual device checks (real iOS home-screen install, live network-kill mid-session) — the automated offline + render checks cover the headless equivalents.
