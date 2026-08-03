// Initial content for each data file when running in mock mode with an empty
// store. Resolves fixtures to concrete values. Pure module.

import { DATA_FILES, INTEGRATIONS } from './config.js';
import * as fx from './fixtures.js';
import { offsetToIso } from './util/dates.js';

export function seedFor(fileKey, now = new Date()) {
  switch (fileKey) {
    case DATA_FILES.trainingPlan:
      return fx.trainingPlan();

    case DATA_FILES.goals:
      return { goals: fx.goals(now) };

    case DATA_FILES.calendarQueue:
      return { queue: [] };

    case DATA_FILES.logs: {
      const entries = [];
      // Weight series (from scale photos) lives in the log, not the health feed.
      for (const w of fx.weight(now)) {
        entries.push({ id: `log-w-${w.date}`, kind: 'weight', at: `${w.date}T07:30`, value: w.kg });
      }
      entries.push({ id: 'log-n-1', kind: 'nutrition', at: `${offsetToIso(-1, now)}T12:40`, text: 'Rice, chicken, salad at lunch. Added a banana before afternoon ride.' });
      entries.push({ id: 'log-s-1', kind: 'subjective', at: `${offsetToIso(-1, now)}T21:00`, text: 'Legs a bit heavy, otherwise good.' });
      return { entries };
    }

    case DATA_FILES.studyBlocks:
      return { blocks: [] };

    case DATA_FILES.socialQueue:
      return { plans: fx.socialQueue(now) };

    case DATA_FILES.syncStatus: {
      const integrations = {};
      for (const key of INTEGRATIONS) {
        integrations[key] = { connected: false, lastSync: null, lastError: null };
      }
      return { integrations };
    }

    default:
      return null;
  }
}
