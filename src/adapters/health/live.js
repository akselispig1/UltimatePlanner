// Health adapter — live. The iOS Shortcut POSTs sleep JSON to the data repo via
// the Contents API on a daily automation; this adapter reads the synced file.
// Signature-identical to mock.js.
import { store } from '../../storage.js';

export const NAME = 'health';

export async function getSleep(sinceIso) {
  let synced = [];
  try {
    synced = (await store.read('data/health-sleep.json')).sleep || [];
  } catch {
    synced = [];
  }
  return sinceIso ? synced.filter((s) => s.date >= sinceIso) : synced;
}

export async function verify() {
  try {
    const s = await store.read('data/sync-status.json');
    return !!(s.integrations && s.integrations.health && s.integrations.health.connected);
  } catch {
    return false;
  }
}
