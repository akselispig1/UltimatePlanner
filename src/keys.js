// Key management (§1.4). Two keys entered once on the setup screen and stored in
// localStorage: a GitHub fine-grained PAT and an Anthropic API key. Plus the
// data-repo identifier. Never logged, never committed, never hardcoded.

import { localKV } from './util/kv.js';

const K = {
  github: 'lb:key:github',
  anthropic: 'lb:key:anthropic',
  repo: 'lb:cfg:repo', // e.g. "octocat/life-balancer-data"
};

export function getGithubKey() {
  return localKV.getItem(K.github) || '';
}
export function getAnthropicKey() {
  return localKV.getItem(K.anthropic) || '';
}
export function getDataRepo() {
  return localKV.getItem(K.repo) || '';
}

export function setKey(which, value) {
  const map = { github: K.github, anthropic: K.anthropic, repo: K.repo };
  if (!map[which]) throw new Error(`unknown key: ${which}`);
  if (value) localKV.setItem(map[which], value);
  else localKV.removeItem(map[which]);
}

export function hasGithubKey() {
  return !!getGithubKey();
}
export function hasAnthropicKey() {
  return !!getAnthropicKey();
}

// True when no keys are connected — the whole app runs on mocks and shows the
// amber demo bar.
export function isDemoMode() {
  return !hasGithubKey() && !hasAnthropicKey();
}

// Per-integration connection status for the setup screen. Strava / Calendar /
// Health / Schoology credentials live in Actions secrets on the data repo, so
// from the phone we can only report them as connected once the data repo is
// wired (GitHub PAT present) and the sync-status file says so. Anthropic is the
// only integration whose key lives on the phone directly.
export function connectionStatus() {
  return {
    anthropic: hasAnthropicKey(),
    github: hasGithubKey(),
  };
}

// Wipe all keys and config (§1.4 "clear all keys" button also unregisters SW —
// that part lives in the UI layer).
export function clearAllKeys() {
  for (const k of Object.values(K)) localKV.removeItem(k);
}
