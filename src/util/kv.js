// A localStorage-like key/value store that works in the browser and in Node.
// In the browser it delegates to window.localStorage. In Node (used by the
// check and logic tests) it falls back to an in-memory shim with the same API.

function makeMemoryKV() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
    _keys: () => [...m.keys()],
  };
}

export const localKV = typeof localStorage !== 'undefined' ? localStorage : makeMemoryKV();

// Enumerate keys with a given prefix in an environment-agnostic way.
export function keysWithPrefix(prefix) {
  const out = [];
  if (typeof localKV._keys === 'function') {
    for (const k of localKV._keys()) if (k.startsWith(prefix)) out.push(k);
  } else {
    for (let i = 0; i < localKV.length; i++) {
      const k = localKV.key(i);
      if (k && k.startsWith(prefix)) out.push(k);
    }
  }
  return out;
}
