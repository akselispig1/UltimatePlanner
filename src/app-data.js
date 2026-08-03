// Central data gathering. Resolves every source the views, chat context and
// tools need — through the adapters (mock or live) and the data store. One place
// so the whole app agrees on "current state".

import { getAdapter } from './adapters/index.js';
import { store } from './storage.js';
import { DATA_FILES } from './config.js';

export async function gatherState(now = new Date()) {
  const strava = getAdapter('strava');
  const health = getAdapter('health');
  const schoology = getAdapter('schoology');

  const [activities, sleep, assignments, trips] = await Promise.all([
    strava.getActivities(),
    health.getSleep(),
    schoology.getAssignments(),
    schoology.getTripEvents(),
  ]);

  const [plan, goalsData, plansData, logsData, socialData, queueData, studyData, syncData] = await Promise.all([
    store.read(DATA_FILES.trainingPlan),
    store.read(DATA_FILES.goals),
    store.read(DATA_FILES.plans),
    store.read(DATA_FILES.logs),
    store.read(DATA_FILES.socialQueue),
    store.read(DATA_FILES.calendarQueue),
    store.read(DATA_FILES.studyBlocks),
    store.read(DATA_FILES.syncStatus),
  ]);

  return {
    now,
    activities,
    sleep,
    assignments,
    externalCal: trips, // trips; weekday school blocks are synthesised in schedule.js
    plan,
    goals: goalsData.goals,
    trainingBlocks: plansData.trainingBlocks || [],
    fuellingPlans: plansData.fuellingPlans || [],
    logs: logsData.entries,
    social: socialData.plans,
    queue: queueData.queue,
    studyBlocks: studyData.blocks,
    sync: syncData.integrations,
  };
}
