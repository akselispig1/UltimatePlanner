// Central data gathering for the calendar scheduler. Resolves the training plan,
// school assignments/trips (via the schoology adapter — mock or live), study
// blocks, the calendar queue and sync status.

import { getAdapter } from './adapters/index.js';
import { store } from './storage.js';
import { DATA_FILES } from './config.js';

export async function gatherState(now = new Date()) {
  const schoology = getAdapter('schoology');
  const [assignments, trips] = await Promise.all([schoology.getAssignments(), schoology.getTripEvents()]);

  const [plan, studyData, queueData, syncData] = await Promise.all([
    store.read(DATA_FILES.trainingPlan),
    store.read(DATA_FILES.studyBlocks),
    store.read(DATA_FILES.calendarQueue),
    store.read(DATA_FILES.syncStatus),
  ]);

  return {
    now,
    plan,
    assignments,
    externalCal: trips, // trips; weekday school blocks are synthesised in schedule.js
    studyBlocks: studyData.blocks,
    queue: queueData.queue,
    sync: syncData.integrations,
  };
}
