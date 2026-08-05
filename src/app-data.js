// Central data gathering for the calendar scheduler. The app's whole state is
// the saved training plan, the calendar queue, and sync status.

import { store } from './storage.js';
import { DATA_FILES } from './config.js';

export async function gatherState(now = new Date()) {
  const [plan, queueData, syncData] = await Promise.all([
    store.read(DATA_FILES.trainingPlan),
    store.read(DATA_FILES.calendarQueue),
    store.read(DATA_FILES.syncStatus),
  ]);

  return {
    now,
    plan,
    queue: queueData.queue,
    sync: syncData.integrations,
  };
}
