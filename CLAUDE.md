# CLAUDE.md — Life Balancer

Guidance for anyone (human or AI) editing this repo. Read before changing chat,
tools, or adapter code.

## What this is

A serverless, single-user **calendar scheduler**. The whole app is one chatbot
whose single job is to put things on the user's **Google Calendar**: their
training plan, their school assignments and study time, and one-off events they
ask for. Frontend is static HTML/CSS/JS on GitHub Pages; the "backend" is GitHub
Actions committing JSON to a private data repo and draining a calendar queue to
Google. The app runs fully on mock data with **no keys** — that is the default
and must never break.

> Scope history: this began as a five-tab life dashboard (training, school,
> nutrition, goals, recovery). Per the owner's direction it was stripped all the
> way back to a calendar-scheduling chatbot. Nutrition/fuelling, goals, weight,
> recovery, the Balancer, Strava and the dashboards were all removed. Don't
> reintroduce them without being asked — the point is a small, focused app.

## Architecture rules

- **Chat is the only surface.** No dashboards, no extra pages. `views/chat.js`
  is the app; `views/settings.js` is a modal (keys) opened from the header gear.
  If you need a new capability, add a **tool**, don't add a screen.
- **Google Calendar is the only output.** Everything the bot decides becomes an
  intent appended to `data/calendar-queue.json` (§1.5). The chatbot never calls
  Google directly. A workflow drains the queue and marks entries `done`.
- **No secrets in the frontend.** Only the user's own Anthropic key and GitHub
  PAT live on the phone (localStorage, entered in the setup modal — §1.4).
  Google/Schoology secrets live in Actions secrets on the data repo. Never
  hardcode or commit any key. `npm run check` greps the build output for
  key-shaped strings and fails if any appear.
- **Adapter rule (§5.1).** Every external service sits behind an adapter with a
  signature-identical `mock.js` and `live.js` under `src/adapters/<svc>/`
  (schoology, calendar, anthropic). Add a method to one → add it to the other in
  the same commit; the check asserts parity.
- **Mock/live selection is automatic** (`src/adapters/index.js`): a key
  appearing flips an adapter live. Never gate behaviour on a code change.
- **The app must run fully with no keys.** Never block the UI behind a setup
  wall. Mock mode shows the amber `DEMO DATA` bar.

## The tools (the whole feature set)

`src/tools.js` — each writes real JSON and says what it scheduled:

- `adjust_training_plan` — edit a day of the weekly plan (`data/training-plan.json`).
- `add_training_to_calendar` — queue the plan's sessions to the calendar for the week(s) ahead.
- `add_assignments_to_calendar` — queue open assignment DUE events (+ optional study blocks).
- `create_study_block` — schedule study time for one assignment; never overlaps a fixed commitment (`features/school.js` + `features/schedule.js`).
- `queue_calendar_change` — add / move / delete a single one-off event.

## Layout

```
index.html, styles.css, manifest.webmanifest, sw.js   PWA shell (offline-first)
src/adapters/<svc>/{mock,live}.js                      schoology, calendar, anthropic
src/features/{schedule,school,training,calendar-queue}.js   pure scheduling logic
src/views/chat.js, settings.js                         the whole UI: chat + setup modal
src/{chat,tools,context,app-data,storage,keys}.js      chat loop, 5 tools, snapshot, data
fixtures/*.json                                        committed fixture snapshots
scripts/check.mjs                                      npm run check
data-repo-template/                                    workflows for the private data repo
```

Data files: `training-plan.json`, `calendar-queue.json`, `study-blocks.json`,
`sync-status.json`. That's the whole store.

## Testing

`npm run check` must pass clean before reporting done. It boots the app headless,
runs the chat tool loop end to end (a request → calendar-queue events), round-
trips every data file against its schema, drains the queue, asserts study blocks
never overlap fixed commitments, greps for secrets, asserts offline render, and
asserts adapter signature parity.

Pure logic lives in DOM-free modules so it can be tested in Node; anything
touching `window`/`document` is exercised via Playwright.
