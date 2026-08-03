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
src/views/*.js                                         Today / Training / School / Chat / Me
src/{chat,tools,context,app-data,storage,keys}.js      chat loop, 6 tools, snapshot, data
fixtures/*.json                                        committed fixture snapshots
scripts/check.mjs                                      npm run check (§5.3)
data-repo-template/                                    workflows for the private data repo
```

## Testing

`npm run check` must pass clean before reporting done. It boots the app headless,
runs the chat tool loop end to end, round-trips every data file against its
schema, drains the queue, asserts study blocks never overlap fixed commitments,
greps for secrets, asserts offline render, and asserts adapter signature parity.

Pure logic lives in DOM-free modules so it can be tested in Node; anything
touching `window`/`document` is exercised via Playwright.
