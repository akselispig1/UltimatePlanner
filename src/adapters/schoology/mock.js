// Schoology adapter — mock. Assignments + trip calendar events (§3.2).
// Signature-identical to live.js.
import * as fx from '../../fixtures.js';

export const NAME = 'schoology';

export async function getAssignments() {
  return fx.assignments();
}

export async function getTripEvents() {
  return fx.externalCalendar().filter((e) => e.kind === 'trip');
}

export async function verify() {
  return true;
}
