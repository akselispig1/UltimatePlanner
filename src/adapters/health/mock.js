// Health adapter — mock. Sleep + resting HR from the Apple Health / Garmin
// shortcut (§3.4). Signature-identical to live.js.
import * as fx from '../../fixtures.js';

export const NAME = 'health';

export async function getSleep(sinceIso) {
  const all = fx.sleep();
  return sinceIso ? all.filter((s) => s.date >= sinceIso) : all;
}

export async function verify() {
  return true;
}
