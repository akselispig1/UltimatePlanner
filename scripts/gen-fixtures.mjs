// Writes resolved fixture snapshots to /fixtures/*.json (§5.1 "committed to
// /fixtures/"). The runtime uses src/fixtures.js directly so the demo stays
// current; these files are a committed, inspectable snapshot. Regenerate with
// `npm run gen:fixtures`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as fx from '../src/fixtures.js';
import { seedFor } from '../src/seed.js';
import { DATA_FILES } from '../src/config.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'fixtures');
mkdirSync(outDir, { recursive: true });

const now = new Date();
const write = (name, data) => {
  writeFileSync(resolve(outDir, name), JSON.stringify(data, null, 2) + '\n');
  console.log('wrote fixtures/' + name);
};

write('activities.json', fx.activities(now));
write('sleep.json', fx.sleep(now));
write('weight.json', fx.weight(now));
write('assignments.json', fx.assignments(now));
write('external-calendar.json', fx.externalCalendar(now));
write('training-plan.json', fx.trainingPlan());
write('goals.json', fx.goals(now));
write('social-queue.json', fx.socialQueue(now));
write('chat-responses.json', { responses: fx.chatResponses(), fallback: fx.CHAT_FALLBACK });

// Seed snapshots of the writable data files.
write('_seed-logs.json', seedFor(DATA_FILES.logs, now));
write('_seed-sync-status.json', seedFor(DATA_FILES.syncStatus, now));

console.log('done');
