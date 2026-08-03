// Minimal, dependency-free JSON schema validation for the data files.
// Each schema is a small descriptor; validate() walks it and collects errors.
// Pure module — importable in Node and browser.

import { DATA_FILES } from './config.js';

// type helpers
const T = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && !Number.isNaN(v),
  boolean: (v) => typeof v === 'boolean',
  object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  array: (v) => Array.isArray(v),
  null: (v) => v === null,
};

function checkType(value, type) {
  if (Array.isArray(type)) return type.some((t) => checkType(value, t));
  return T[type] ? T[type](value) : false;
}

// desc: { type, required?, props?, items?, enum? }
function walk(value, desc, path, errors) {
  if (desc.type && !checkType(value, desc.type)) {
    errors.push(`${path}: expected ${JSON.stringify(desc.type)}, got ${value === null ? 'null' : typeof value}`);
    return;
  }
  if (desc.enum && !desc.enum.includes(value)) {
    errors.push(`${path}: "${value}" not in ${JSON.stringify(desc.enum)}`);
  }
  if (desc.props && T.object(value)) {
    for (const [key, sub] of Object.entries(desc.props)) {
      const has = Object.prototype.hasOwnProperty.call(value, key);
      if (sub.required && !has) {
        errors.push(`${path}.${key}: required`);
        continue;
      }
      if (has) walk(value[key], sub, `${path}.${key}`, errors);
    }
  }
  if (desc.items && T.array(value)) {
    value.forEach((item, i) => walk(item, desc.items, `${path}[${i}]`, errors));
  }
}

export function validate(value, schema) {
  const errors = [];
  walk(value, schema, schema.name || 'root', errors);
  return { valid: errors.length === 0, errors };
}

// ---- Schemas ----

export const SCHEMAS = {
  [DATA_FILES.trainingPlan]: {
    name: 'training-plan',
    type: 'object',
    props: {
      updatedAt: { type: ['string', 'null'] },
      sessions: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          props: {
            id: { type: 'string', required: true },
            day: { type: 'string', required: true, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
            type: { type: 'string', required: true },
            durationMin: { type: 'number', required: true },
            intensity: { type: 'string', required: true },
            note: { type: 'string' },
          },
        },
      },
    },
  },

  [DATA_FILES.goals]: {
    name: 'goals',
    type: 'object',
    props: {
      goals: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          props: {
            id: { type: 'string', required: true },
            title: { type: 'string', required: true },
            type: { type: 'string', required: true, enum: ['performance', 'consistency', 'school', 'recovery'] },
            target: { type: 'string', required: true },
            deadline: { type: ['string', 'null'], required: true },
            status: { type: 'string', enum: ['active', 'retired'] },
          },
        },
      },
    },
  },

  [DATA_FILES.calendarQueue]: {
    name: 'calendar-queue',
    type: 'object',
    props: {
      queue: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          props: {
            id: { type: 'string', required: true },
            action: { type: 'string', required: true, enum: ['create', 'update', 'delete'] },
            event: { type: 'object', required: true },
            status: { type: 'string', required: true, enum: ['pending', 'done', 'error'] },
            resultEventId: { type: ['string', 'null'] },
          },
        },
      },
    },
  },

  [DATA_FILES.logs]: {
    name: 'logs',
    type: 'object',
    props: {
      entries: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          props: {
            id: { type: 'string', required: true },
            kind: { type: 'string', required: true, enum: ['nutrition', 'weight', 'subjective'] },
            at: { type: 'string', required: true },
          },
        },
      },
    },
  },

  [DATA_FILES.studyBlocks]: {
    name: 'study-blocks',
    type: 'object',
    props: {
      blocks: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          props: {
            id: { type: 'string', required: true },
            assignmentId: { type: ['string', 'null'], required: true },
            title: { type: 'string', required: true },
            date: { type: 'string', required: true },
            start: { type: 'string', required: true },
            durationMin: { type: 'number', required: true },
          },
        },
      },
    },
  },

  [DATA_FILES.socialQueue]: {
    name: 'social-queue',
    type: 'object',
    props: {
      plans: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          props: {
            id: { type: 'string', required: true },
            what: { type: 'string', required: true },
            when: { type: 'string', required: true },
            status: { type: 'string', required: true, enum: ['pending', 'confirmed', 'discarded'] },
          },
        },
      },
    },
  },

  [DATA_FILES.syncStatus]: {
    name: 'sync-status',
    type: 'object',
    props: {
      integrations: { type: 'object', required: true },
    },
  },
};

export function schemaFor(fileKey) {
  return SCHEMAS[fileKey];
}
