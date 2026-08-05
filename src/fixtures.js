// Realistic demo fixtures (§5.1). Data is anchored to "now" via day offsets so
// the demo always looks current. Deterministic (seeded) so runs are repeatable.
// Pure module — importable in Node and the browser.

import { offsetToIso } from './util/dates.js';

// --- Schoology assignments: a dozen, varying urgency and weight. ---
export function assignments(now = new Date()) {
  const raw = [
    ['Physics: Forces problem set', 'Physics', -1, 5, 'submitted'],
    ['English essay: Of Mice and Men', 'English', 2, 20, 'open'],
    ['Maths: Quadratics worksheet', 'Mathematics', 1, 8, 'open'],
    ['History source analysis', 'History', 4, 15, 'open'],
    ['Biology lab write-up', 'Biology', 6, 12, 'open'],
    ['Spanish vocab quiz', 'Spanish', 3, 6, 'open'],
    ['Geography fieldwork report', 'Geography', 9, 18, 'open'],
    ['Maths: Trigonometry test', 'Mathematics', 12, 25, 'open'],
    ['Design tech portfolio', 'Design', 16, 30, 'open'],
    ['Chemistry mole calculations', 'Chemistry', 5, 10, 'open'],
    ['English reading log', 'English', 0, 4, 'open'],
    ['PE theory: training zones', 'PE', 21, 8, 'open'],
  ];
  return raw.map(([title, course, dueOffset, weight, status], i) => ({
    id: `asg-${i + 1}`,
    title,
    course,
    due: offsetToIso(dueOffset, now),
    weight, // relative importance; drives study-block sizing
    status,
    source: 'schoology',
  }));
}

// --- Calendar events already on the school/trips calendar (external, read-only). ---
export function externalCalendar(now = new Date()) {
  return [
    { id: 'cal-trip-1', title: 'Geography field trip — Ticino', date: offsetToIso(10, now), endDate: offsetToIso(11, now), allDay: true, kind: 'trip', source: 'schoology' },
    { id: 'cal-sch-1', title: 'School day', date: offsetToIso(1, now), allDay: false, start: '08:15', end: '15:30', kind: 'school', source: 'schoology' },
    { id: 'cal-sch-2', title: 'School day', date: offsetToIso(2, now), allDay: false, start: '08:15', end: '15:30', kind: 'school', source: 'schoology' },
  ];
}

// --- Seed training plan (weekly, recurring by weekday). ---
export function trainingPlan() {
  return {
    updatedAt: null,
    sessions: [
      { id: 'ses-mon', day: 'Mon', type: 'gym', durationMin: 45, intensity: 'easy', note: 'Strength — legs + core' },
      { id: 'ses-tue', day: 'Tue', type: 'ride', durationMin: 90, intensity: 'endurance', note: 'Zone 2 trail miles' },
      { id: 'ses-wed', day: 'Wed', type: 'rest', durationMin: 0, intensity: 'recovery', note: 'Rest / mobility' },
      { id: 'ses-thu', day: 'Thu', type: 'ride', durationMin: 75, intensity: 'threshold', note: 'Intervals — 4x6min' },
      { id: 'ses-fri', day: 'Fri', type: 'gym', durationMin: 40, intensity: 'easy', note: 'Upper body + core' },
      { id: 'ses-sat', day: 'Sat', type: 'ride', durationMin: 150, intensity: 'endurance', note: 'Long trail ride' },
      { id: 'ses-sun', day: 'Sun', type: 'ride', durationMin: 60, intensity: 'recovery', note: 'Easy spin' },
    ],
  };
}

// --- Canned chat responses incl. tool calls (§5.1). Matched by keyword. ---
// Each entry is a list of assistant "steps": either {text} or {tool, input}.
// After a tool step the mock feeds the tool result back and continues.
export function chatResponses() {
  return [
    {
      match: ['training plan', 'add my training', 'put my training', 'schedule my training', 'add training', 'put training', 'training on my calendar', 'training to my calendar'],
      steps: [
        { text: "Sure — I'll put this week's sessions from your training plan onto your Google Calendar." },
        { tool: 'add_training_to_calendar', input: { weeks: 1 } },
        { text: "Done — your training sessions are queued to Google Calendar for the week." },
      ],
    },
    {
      match: ['assignment', 'homework', 'schoology', 'due date', 'due dates', 'school work', 'add my assignments', 'put my assignments'],
      steps: [
        { text: "I'll pull your open assignments and put their due dates on your calendar, with study blocks in the free evenings." },
        { tool: 'add_assignments_to_calendar', input: { includeStudyBlocks: true } },
        { text: "Added your assignment due dates and study blocks to Google Calendar." },
      ],
    },
    {
      match: ['study', 'revise', 'revision', 'essay', 'exam'],
      steps: [
        { text: "I'll block out 60 minutes for the English essay in a free evening slot." },
        { tool: 'create_study_block', input: { assignmentTitle: 'English essay: Of Mice and Men', durationMin: 60 } },
        { text: 'Scheduled a 60-minute study block and queued it to your calendar.' },
      ],
    },
    {
      match: ['make thursday', 'change thursday', 'thursday a', 'make tuesday', 'change my plan', 'longer ride', 'rest day', 'swap', 'make it a'],
      steps: [
        { text: "I'll change Thursday to an endurance ride — want that applied?" },
        { tool: 'adjust_training_plan', input: { day: 'Thu', type: 'ride', intensity: 'endurance', note: 'Changed via chat' } },
        { text: "Updated Thursday to an endurance ride. Say the word and I'll push the plan to your calendar." },
      ],
    },
    {
      match: ['add', 'remind', 'tomorrow', 'appointment', 'practice', 'football', 'dentist', 'put '],
      steps: [
        { text: "I'll add that to your calendar." },
        { tool: 'queue_calendar_change', input: { action: 'create', event: { title: 'Football practice', date: '+1', start: '17:00', durationMin: 90 } } },
        { text: "Queued it to your Google Calendar — it shows as pending until the sync runs." },
      ],
    },
  ];
}

// Default assistant reply when nothing matches.
export const CHAT_FALLBACK = {
  steps: [
    { text: "I put things on your Google Calendar. I can schedule your training plan, add your assignment due dates and study time, or add a one-off event — just tell me what and when." },
  ],
};
