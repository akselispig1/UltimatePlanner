# SETUP.md — connecting Life Balancer

The app runs fully on demo data with **no keys**. Connect integrations in the
order below (easiest first). Each flips its own adapter from mock to live
independently — connecting one never breaks the others. When all are live the
amber **DEMO DATA** bar disappears on its own.

Keys you enter on the phone live in `localStorage` only (never committed).
Third-party secrets live in **GitHub Actions secrets** on your private
`life-balancer-data` repo.

---

## 1. Anthropic key — chat goes live immediately

- **Get it:** https://console.anthropic.com → *Settings → API Keys → Create Key*. Copy the `sk-ant-...` value.
- **Where it goes:** app → **Me → Setup → Anthropic API key** field → *Save keys*.
- **Test:** open **Chat**, send "hi". A live model reply (not a canned demo line) confirms it. If the key is rejected the app says so and links back to Setup.

> The browser calls the Anthropic API directly with the
> `anthropic-dangerous-direct-browser-access: true` header (§1.4). This is a
> deliberate single-user trade-off to keep chat fast.

## 2. GitHub fine-grained PAT — data persists to your private repo

- **Create the repo first:** a private repo named `life-balancer-data` with folders `data/` and `inbox/`.
- **Get the token:** https://github.com/settings/tokens?type=beta → *Generate new token* → **Resource owner:** you → **Repository access:** *Only select repositories → life-balancer-data* → **Permissions → Repository → Contents: Read and write**. Copy the `github_pat_...` value.
- **Where it goes:** app → **Me → Setup** → **GitHub fine-grained PAT** field, and set **Data repo** to `your-username/life-balancer-data` → *Save keys*.
- **Test:** in the app change anything (e.g. retire a goal), then check the repo — `data/goals.json` should show a new commit.

## 3. Google Calendar — the primary output surface

Google's OAuth refresh token must never be in the browser (§1.5), so calendar
writes run in Actions.

- **Create a dedicated calendar** named "Life Balancer" in Google Calendar (so it never touches your real one). Copy its **Calendar ID** (*Settings → Integrate calendar*).
- **Get a refresh token:** create OAuth credentials at https://console.cloud.google.com/apis/credentials (enable the Calendar API), then run the one-off local helper `data-repo-template/scripts/google-oauth.mjs` and follow the URL to authorise. It prints a refresh token.
- **Where it goes (Actions secrets on `life-balancer-data`):** repo **Settings → Secrets and variables → Actions**:
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID`.
- **Test:** queue a change in Chat ("add tomorrow's ride to my calendar"), wait for the 15-min `calendar-sync` workflow (or run it manually from the Actions tab). The event appears on the Life Balancer calendar and the queue entry flips to `done`.

## 4. Strava — training sync

- **Create an API app:** https://www.strava.com/settings/api. Note the **Client ID** and **Client Secret**.
- **Get a refresh token:** run `data-repo-template/scripts/strava-oauth.mjs` locally, authorise, copy the printed refresh token.
- **Where it goes (Actions secrets):** `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`.
- **Test:** run the `strava-sync` workflow. `data/strava-activities.json` gains recent rides, and completed sessions in the app show `✓` with actual duration/climbing.

> Webhooks need a public callback URL, so we **poll** `/athlete/activities` every 30 min instead.

## 5. Apple Health / Garmin — sleep

Garmin's Health API needs partner approval (unrealistic solo), so we read sleep
from **Apple Health** (Garmin syncs into it) via an iOS Shortcut (§2, §3.4).

- **Build the Shortcut:** *Health → Find Sleep Samples (last night)* + *Resting Heart Rate* → format as JSON → *Get Contents of URL* PUT to the GitHub Contents API for `data/health-sleep.json` (Authorization: `Bearer <PAT>`). Trigger it on a daily *Automation*.
- **Where it goes:** the Shortcut uses the same fine-grained PAT (step 2). No Actions secret needed.
- **Test:** run the Shortcut once; `data/health-sleep.json` updates and **Me → Recovery** shows last night's score.

## 6. Schoology — assignments + trips

**Check first (§3.2):** go to https://schoology.com/api — if your school (ISZL)
has disabled personal API keys, **stay on manual assignment entry** and skip this.

- **Get keys:** if enabled, generate your **Consumer Key** and **Secret** on that page.
- **Where it goes (Actions secrets):** `SCHOOLOGY_KEY`, `SCHOOLOGY_SECRET`, `SCHOOLOGY_BASE` (your school's API host).
- **Test:** run the `schoology-sync` workflow. `data/schoology.json` fills with assignments and trip events; the **School** view shows them and trips appear as all-day calendar events.

> OAuth 1.0 request signing happens in Actions, never the browser.

---

## Optional (Phase 7) — Push notifications

VAPID keys + subscribe flow + scheduled reminders. The calendar may well be
enough; wire this only if you want the morning summary as a push. See §5.5.
