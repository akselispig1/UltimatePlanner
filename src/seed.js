// Initial content for each data file when running in mock mode with an empty
// store. Pure module.

import { DATA_FILES, INTEGRATIONS } from './config.js';
import * as fx from './fixtures.js';

export function seedFor(fileKey) {
  switch (fileKey) {
    case DATA_FILES.trainingPlan:
      return fx.trainingPlan();

    case DATA_FILES.calendarQueue:
      return { queue: [] };

    case DATA_FILES.syncStatus: {
      const integrations = {};
      for (const key of INTEGRATIONS) integrations[key] = { connected: false, lastSync: null, lastError: null };
      return { integrations };
    }

    default:
      return null;
  }
}
