// Strava adapter — live. On the phone we never call Strava directly (the OAuth
// refresh token lives in Actions secrets). A scheduled Action polls Strava and
// commits /data/strava-activities.json to the data repo; this adapter reads that
// synced file via the storage layer. Signature-identical to mock.js.
import { store } from '../../storage.js';

export const NAME = 'strava';

export async function getActivities(sinceIso) {
  let synced = [];
  try {
    synced = (await store.read('data/strava-activities.json')).activities || [];
  } catch {
    synced = [];
  }
  return sinceIso ? synced.filter((a) => a.date >= sinceIso) : synced;
}

export async function verify() {
  // "Connected" from the phone means the data repo is wired and syncing.
  try {
    const s = await store.read('data/sync-status.json');
    return !!(s.integrations && s.integrations.strava && s.integrations.strava.connected);
  } catch {
    return false;
  }
}
