// Adapter selector (§5.1). Each external service has a signature-identical
// mock.js and live.js. Selection is automatic — a key appearing flips live,
// never a code change. In full demo mode (no keys) every adapter is mock.

import * as stravaMock from './strava/mock.js';
import * as stravaLive from './strava/live.js';
import * as healthMock from './health/mock.js';
import * as healthLive from './health/live.js';
import * as schoologyMock from './schoology/mock.js';
import * as schoologyLive from './schoology/live.js';
import * as calendarMock from './calendar/mock.js';
import * as calendarLive from './calendar/live.js';
import * as anthropicMock from './anthropic/mock.js';
import * as anthropicLive from './anthropic/live.js';

import { hasAnthropicKey, hasGithubKey } from '../keys.js';

// Data-sourced integrations (Strava/Health/Schoology/Calendar) go live once the
// data repo is wired (GitHub PAT present); Anthropic goes live on its own key.
export const REGISTRY = {
  strava: { mock: stravaMock, live: stravaLive, gate: hasGithubKey },
  health: { mock: healthMock, live: healthLive, gate: hasGithubKey },
  schoology: { mock: schoologyMock, live: schoologyLive, gate: hasGithubKey },
  calendar: { mock: calendarMock, live: calendarLive, gate: hasGithubKey },
  anthropic: { mock: anthropicMock, live: anthropicLive, gate: hasAnthropicKey },
};

export const ADAPTER_NAMES = Object.keys(REGISTRY);

export function getAdapter(name) {
  const entry = REGISTRY[name];
  if (!entry) throw new Error(`unknown adapter: ${name}`);
  return entry.gate() ? entry.live : entry.mock;
}

export function adapterMode(name) {
  return REGISTRY[name].gate() ? 'live' : 'mock';
}
