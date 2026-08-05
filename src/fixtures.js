// Realistic demo fixtures. Data is anchored to "now" via day offsets so the demo
// always looks current. Pure module — importable in Node and the browser.

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

// --- Canned chat responses incl. tool calls. Matched by keyword. ---
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
      match: ['make thursday', 'change thursday', 'thursday a', 'make tuesday', 'change my plan', 'longer ride', 'rest day', 'swap', 'make it a'],
      steps: [
        { text: "I'll change Thursday to an endurance ride — want that applied?" },
        { tool: 'adjust_training_plan', input: { day: 'Thu', type: 'ride', intensity: 'endurance', note: 'Changed via chat' } },
        { text: "Updated Thursday to an endurance ride. Say the word and I'll push the plan to your calendar." },
      ],
    },
    {
      match: ['add', 'remind', 'tomorrow', 'appointment', 'practice', 'football', 'dentist', 'put ', 'schedule', 'meeting', 'party', 'birthday'],
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
    { text: "I put things on your Google Calendar. Tell me an event and when — like \"add football practice tomorrow at 5\" — or say \"put my training plan on my calendar\"." },
  ],
};
