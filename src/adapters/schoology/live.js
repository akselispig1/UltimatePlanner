// Schoology adapter — live. OAuth 1.0 request signing happens in Actions (never
// the browser, §3.2). The Action commits /data/schoology.json; this adapter
// reads the synced file. If ISZL blocks API keys, the sync file stays empty and
// the app falls back to manual assignment entry. Signature-identical to mock.js.
import { store } from '../../storage.js';

export const NAME = 'schoology';

async function readSynced() {
  try {
    return await store.read('data/schoology.json');
  } catch {
    return {};
  }
}

export async function getAssignments() {
  return (await readSynced()).assignments || [];
}

export async function getTripEvents() {
  return (await readSynced()).trips || [];
}

export async function verify() {
  try {
    const s = await store.read('data/sync-status.json');
    return !!(s.integrations && s.integrations.schoology && s.integrations.schoology.connected);
  } catch {
    return false;
  }
}
