// Strava adapter — mock. Returns fixture activities (§5.1). Signature-identical
// to live.js.
import * as fx from '../../fixtures.js';

export const NAME = 'strava';

export async function getActivities(sinceIso) {
  const all = fx.activities();
  return sinceIso ? all.filter((a) => a.date >= sinceIso) : all;
}

export async function verify() {
  return true;
}
