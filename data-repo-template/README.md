# life-balancer-data (private) — automation templates

These files belong in the **private** `life-balancer-data` repo, not the PWA
repo. They are the "backend": scheduled GitHub Actions that sync APIs and drain
the calendar queue, committing JSON under `data/`.

## Contents

```
.github/workflows/
  calendar-sync.yml   every 15 min — drains data/calendar-queue.json to Google Calendar (§1.5)
  strava-sync.yml     every 30 min — polls Strava, writes data/strava-activities.json (§2)
  schoology-sync.yml  every 6 h    — pulls assignments + trips → data/schoology.json (§3.2)
  balancer.yml        nightly      — composes tomorrow, appends calendar intents (§3.7)
scripts/
  drain-calendar.mjs  Google Calendar writes for queued intents
  sync-strava.mjs     Strava activity poll
  sync-schoology.mjs  Schoology OAuth 1.0 pull
  run-balancer.mjs    nightly composition → calendar-queue.json
  google-oauth.mjs    one-off local helper: prints a Google refresh token
  strava-oauth.mjs    one-off local helper: prints a Strava refresh token
```

## Setup

1. Create the private repo with a `data/` folder (seed it with the app's data
   files, or let the app create them on first write).
2. Add **Actions secrets** (Settings → Secrets and variables → Actions):
   - `DATA_PAT` — a fine-grained PAT with Contents read+write on this repo. Used
     for checkout **and** commits so scheduled workflows count as repo activity
     and don't auto-disable after 60 days (§1.6).
   - Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID`
   - Strava: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`
   - Schoology (if enabled): `SCHOOLOGY_KEY`, `SCHOOLOGY_SECRET`, `SCHOOLOGY_BASE`
3. Enable Actions. Each workflow can also be run manually (workflow_dispatch)
   for testing — see the one-line tests in `SETUP.md`.

## Design notes

- **Idempotent + safe to re-run** (§6). Drain only touches `pending` queue
  entries; the balancer dedupes by a stable key before appending.
- **Cron is best-effort** (§1.6): jobs may fire 5–20 min late. Nothing depends on
  exact timing.
- Every run records success/failure per integration in `data/sync-status.json`,
  which the app reads to show last-sync time and connection state.
- These scripts are the reference "live" side of the adapters in the PWA
  (`src/adapters/*/live.js`). Keep their data shapes in sync.
