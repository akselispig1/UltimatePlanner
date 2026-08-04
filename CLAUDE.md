# CLAUDE.md — Life Balancer

Guidance for anyone (human or AI) editing this repo. Read before changing chat,
nutrition, or adapter code.

## What this is

A serverless, single-user life-planning PWA. Frontend is static HTML/CSS/JS on
GitHub Pages; the "backend" is GitHub Actions committing JSON to a private data
repo. The whole app runs on mock data with **no keys** — that is the default and
must never break.

## Nutrition rules — NON-NEGOTIABLE (§3.5)

The user is 14 and still growing. This feature supports fuelling for sport and
school, never restriction. These rules are injected **verbatim** into the
Anthropic system prompt (`src/config.js` → `NUTRITION_RULES`) and are duplicated
here so they survive future edits. If you touch the system prompt, keep them
identical in both places.

- Frame all feedback around adequacy and performance: "you'll want more carbs before tomorrow's ride", "add a protein source here".
- Do **not** display calorie targets, calorie deficits, or macro percentage goals.
- Do **not** set, suggest, or track a goal weight. Scale photos log a number and a trend line, nothing more.
- Do **not** rank foods as good/bad, or use language like "cheat meal", "earned", or "burn off".
- Never link food intake to exercise output in the same view or sentence.
- If input suggests skipped meals or restriction, surface a gentle prompt to talk to a parent or coach — not a plan adjustment.

`src/features/nutrition.js` enforces the non-model parts: weight is a number +
trend only (`weightTrend`, no goal weight), and `restrictionCheck` returns the
gentle parent/coach prompt. Do not add calorie or goal-weight features.

**"Diet plans" are fuelling plans.** When the user asks for a diet/meal plan, it
is built as a *fuelling* plan via the `set_fuelling_plan` tool — guidance for
eating to support training and school, framed around adequacy and performance.
The tool runs every entry through `sanitizeFuelling`/`FORBIDDEN_FUELLING`, so
even a misbehaving model cannot produce calorie targets, a goal weight, or
good/bad-food language. Keep that sanitiser in place.

## Goal-linked plans (§3.1 / §3.6)

Goals are the anchor for richer planning. Two chat tools write to
`data/plans.json`:

- `set_training_block` — a structured, progressive multi-week training block
  (`buildProgressiveBlock`: base → build → taper), optionally linked to a goal.
  Shown on the Training tab.
- `set_fuelling_plan` — the fuelling plan above, shown on the Me tab.

Both upsert by `goalId` (one active plan of a kind per goal). The Balancer and
`adjust_training_plan` still own the active weekly template
(`data/training-plan.json`); a training block is a planning document layered on
top.

## Architecture rules

- **No secrets in the frontend.** Only the user's own Anthropic key and GitHub
  PAT live on the phone (localStorage, entered on the setup screen — §1.4).
  Third-party secrets (Strava/Google/Schoology) live in Actions secrets on the
  data repo. Never hardcode or commit any key. `npm run check` greps the build
  output for key-shaped strings and fails if any appear.
- **Adapter rule (§5.1).** Every external service sits behind an adapter with a
  signature-identical `mock.js` and `live.js` under `src/adapters/<svc>/`. If you
  add a method to one, add it to the other in the same commit — the check
  asserts parity.
- **Mock/live selection is automatic** (`src/adapters/index.js`): a key
  appearing flips an adapter live. Never gate behaviour on a code change.
- **Calendar writes go through a queue** (§1.5). The chatbot and Balancer never
  call Google directly; they append intents to `data/calendar-queue.json`. A
  workflow drains it. The UI shows queued items as pending.
- **The app must run fully with no keys.** Never block the UI behind a setup
  wall. Mock mode shows the amber `DEMO DATA` bar.
- **Fixtures must stay realistic** (§6): missed sessions, bad nights, late
  assignments. They are now-relative (see `src/fixtures.js`).

## Layout

```
index.html, styles.css, manifest.webmanifest, sw.js   PWA shell (offline-first)
src/adapters/<svc>/{mock,live}.js                      external services
src/features/*.js                                      pure logic (training, school,
                                                       recovery, nutrition, balancer,
                                                       goals, calendar-queue, schedule)
src/views/chat.js, settings.js                         the whole UI: chat + setup modal
src/{chat,tools,context,app-data,storage,keys}.js      chat loop, 8 tools, snapshot, data
fixtures/*.json                                        committed fixture snapshots
scripts/check.mjs                                      npm run check (§5.3)
data-repo-template/                                    workflows for the private data repo
```

**The app is chat-first.** Per the owner's direction there are no dashboard tabs.
The primary surface is `views/chat.js` (conversation + inline plan confirmations).
There is **one** extra page, `views/food.js` (Food & fuelling), reached from a
header icon — meal advice and the weight trend don't belong on a calendar (§3.5),
so they live there. Keys live in `views/settings.js` (a modal opened from the
header gear). This matches §1: chat is the primary input, Google Calendar the
primary output. Info a dashboard would show is answered by the bot or read from
the calendar. Don't add further standalone screens — add a tool or surface it in
chat, and keep nutrition on the Food page.

## Testing

`npm run check` must pass clean before reporting done. It boots the app headless,
runs the chat tool loop end to end, round-trips every data file against its
schema, drains the queue, asserts study blocks never overlap fixed commitments,
greps for secrets, asserts offline render, and asserts adapter signature parity.

Pure logic lives in DOM-free modules so it can be tested in Node; anything
touching `window`/`document` is exercised via Playwright.
