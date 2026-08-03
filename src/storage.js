// Data-file storage abstraction. Two backends, selected automatically by whether
// a GitHub PAT is present (§5.1 adapter rule — no code change, only a key
// appearing):
//   - mock: localStorage (browser) / in-memory (Node), seeded from fixtures.
//   - live: the private life-balancer-data repo via the Contents API.
// The app only ever calls read()/write(); it never knows which backend is live.

import { seedFor } from './seed.js';
import { localKV, keysWithPrefix } from './util/kv.js';
import { getGithubKey, getDataRepo, hasGithubKey } from './keys.js';
import { githubClient } from './github.js';

const PREFIX = 'lb:file:';
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

// ---- mock backend: local key/value, seeded lazily from fixtures ----
export function mockBackend(now = new Date()) {
  return {
    kind: 'mock',
    async read(fileKey) {
      const raw = localKV.getItem(PREFIX + fileKey);
      if (raw == null) {
        const seeded = seedFor(fileKey, now) ?? {};
        localKV.setItem(PREFIX + fileKey, JSON.stringify(seeded));
        return clone(seeded);
      }
      return JSON.parse(raw);
    },
    async write(fileKey, data) {
      localKV.setItem(PREFIX + fileKey, JSON.stringify(data));
      return clone(data);
    },
    reset() {
      for (const k of keysWithPrefix(PREFIX)) localKV.removeItem(k);
    },
  };
}

// ---- live backend: GitHub Contents API ----
export function liveBackend() {
  const client = githubClient({ token: getGithubKey(), repo: getDataRepo() });
  return {
    kind: 'live',
    async read(fileKey) {
      const { content } = await client.getFile(fileKey);
      if (content == null) {
        // File not created yet in the repo — seed it and write it back.
        const seeded = seedFor(fileKey) ?? {};
        await client.putFile(fileKey, JSON.stringify(seeded, null, 2), `seed ${fileKey}`);
        return seeded;
      }
      return JSON.parse(content);
    },
    async write(fileKey, data) {
      await client.putFile(fileKey, JSON.stringify(data, null, 2), `update ${fileKey}`);
      return data;
    },
    reset() {
      /* live data is never wiped from the client */
    },
  };
}

export function pickBackend(now = new Date()) {
  return hasGithubKey() && getDataRepo() ? liveBackend() : mockBackend(now);
}

// Public store. Callers use read()/write(); the backend is chosen per call so a
// key appearing mid-session flips it live with no reload required.
export const store = {
  async read(fileKey) {
    return pickBackend().read(fileKey);
  },
  async write(fileKey, data) {
    return pickBackend().write(fileKey, data);
  },
  // Test/helper: build a store bound to a fixed backend (used by the check).
  withBackend(backend) {
    return {
      read: (k) => backend.read(k),
      write: (k, d) => backend.write(k, d),
      reset: () => backend.reset && backend.reset(),
    };
  },
};
