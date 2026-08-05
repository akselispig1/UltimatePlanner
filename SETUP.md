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
- **Test:** ask in Chat "put my training plan on my calendar", wait for the 15-min `calendar-sync` workflow (or run it manually from the Actions tab). The events appear on the Life Balancer calendar and the queue entries flip to `done`.

## 4. Schoology — assignments (optional)

Lets the bot pull your real assignments so it can put their due dates and study
blocks on your calendar. If your school has disabled personal API keys, skip
this and just tell the bot your deadlines directly.

**Check first (§3.2):** go to https://schoology.com/api — if it lets you generate a key.

- **Get keys:** generate your **Consumer Key** and **Secret** on that page.
- **Where it goes (Actions secrets):** `SCHOOLOGY_KEY`, `SCHOOLOGY_SECRET`, `SCHOOLOGY_BASE` (your school's API host).
- **Test:** run the `schoology-sync` workflow. `data/schoology.json` fills with assignments; ask the bot "add my assignments to my calendar" and the due dates get queued.

> OAuth 1.0 request signing happens in Actions, never the browser.

---

## Optional (Phase 7) — Push notifications

VAPID keys + subscribe flow + scheduled reminders. The calendar may well be
enough; wire this only if you want the morning summary as a push. See §5.5.
