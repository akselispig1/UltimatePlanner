// Shared helpers for the data-repo Actions scripts. Node 20+, no dependencies.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function readJSON(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

export async function writeJSON(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + '\n');
}

// Record per-integration sync outcome so the app can show last-sync + status.
export async function recordStatus(name, ok, error = null) {
  const path = 'data/sync-status.json';
  const s = await readJSON(path, { integrations: {} });
  s.integrations[name] = { connected: ok, lastSync: new Date().toISOString(), lastError: ok ? null : String(error) };
  await writeJSON(path, s);
}

// Exchange an OAuth2 refresh token for a short-lived access token.
export async function refreshAccessToken({ tokenUrl, clientId, clientSecret, refreshToken, extra = {} }) {
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token', ...extra });
  const res = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) throw new Error(`token refresh ${res.status}: ${await res.text()}`);
  return res.json();
}
