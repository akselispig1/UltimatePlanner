# life-balancer-data (private) — automation templates

These files belong in the **private** `life-balancer-data` repo, not the PWA
repo. They are the "backend": scheduled GitHub Actions that drain the calendar
queue to Google Calendar and pull assignments from Schoology, committing JSON
under `data/`.

## Contents

```
.github/workflows/
  calendar-sync.yml   every 15 min — drains data/calendar-queue.json to Google Calendar (§1.5)
  schoology-sync.yml  every 6 h    — pulls assignments + trips → data/schoology.json (§3.2)
scripts/
  drain-calendar.mjs  Google Calendar writes for queued intents
  sync-schoology.mjs  Schoology OAuth 1.0 pull
  google-oauth.mjs    one-off local helper: prints a Google refresh token
  lib.mjs             shared helpers
```

## Setup

1. Create the private repo with a `data/` folder (seed it with the app's data
   files, or let the app create them on first write).
2. Add **Actions secrets** (Settings → Secrets and variables → Actions):
   - `DATA_PAT` — a fine-grained PAT with Contents read+write on this repo. Used
     for checkout **and** commits so scheduled workflows count as repo activity
     and don't auto-disable after 60 days (§1.6).
   - Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID`
   - Schoology (if enabled): `SCHOOLOGY_KEY`, `SCHOOLOGY_SECRET`, `SCHOOLOGY_BASE`
3. Enable Actions. Each workflow can be run manually (workflow_dispatch) for
   testing — see the one-line tests in `SETUP.md`.

## Design notes

- **Idempotent + safe to re-run** (§6). The drain only touches `pending` queue
  entries.
- **Cron is best-effort** (§1.6): jobs may fire 5–20 min late. Nothing depends on
  exact timing.
- Every run records success/failure per integration in `data/sync-status.json`,
  which the app reads to show last-sync time and connection state.
- These scripts are the reference "live" side of the app's adapters
  (`src/adapters/*/live.js`). Keep their data shapes in sync.

> This app is a calendar scheduler; Strava and the nightly Balancer that earlier
> drafts included were removed. If you re-add training/activity sync later, add a
> matching adapter + workflow here.
