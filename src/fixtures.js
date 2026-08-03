// Realistic demo fixtures (§5.1). Data is anchored to "now" via day offsets so
// the demo always looks current. Deterministic (seeded) so runs are repeatable.
// Pure module — importable in Node and the browser.

import { offsetToIso, isoDate, addDays, today, weekdayName, seeded } from './util/dates.js';

// --- Strava-style activities: ~6 weeks, rides + gym, with gaps and missed days ---
export function activities(now = new Date()) {
  const out = [];
  let id = 1;
  for (let back = 42; back >= 1; back--) {
    const r = seeded(back * 7 + 3);
    // Roughly 4 active days a week: skip when the seed is low → natural gaps.
    if (r < 0.42) continue;
    const date = offsetToIso(-back, now);
    const dow = new Date(addDays(today(now), -back)).getDay();
    const isRide = dow === 2 || dow === 4 || dow === 6 || dow === 0; // Tue/Thu/Sat/Sun ride
    if (isRide) {
      const dur = 55 + Math.round(seeded(back) * 80); // 55–135 min
      out.push({
        id: `act-${id++}`,
        date,
        type: 'ride',
        sport: 'MountainBikeRide',
        durationMin: dur,
        distanceM: Math.round(dur * (170 + seeded(back * 2) * 90)),
        climbingM: Math.round(dur * (7 + seeded(back * 3) * 8)),
        source: 'strava',
      });
    } else {
      const dur = 35 + Math.round(seeded(back * 5) * 30);
      out.push({
        id: `act-${id++}`,
        date,
        type: 'gym',
        sport: 'WeightTraining',
        durationMin: dur,
        distanceM: 0,
        climbingM: 0,
        source: 'strava',
      });
    }
  }
  return out;
}

// --- Sleep: ~6 weeks, from the Apple Health / Garmin shortcut. A couple of bad nights. ---
export function sleep(now = new Date()) {
  const out = [];
  for (let back = 42; back >= 1; back--) {
    const r = seeded(back * 11 + 1);
    // Two deliberately poor consecutive nights recently (nights 5 and 6 ago).
    const bad = back === 5 || back === 6 || r < 0.08;
    const durationMin = bad ? 300 + Math.round(seeded(back) * 40) : 430 + Math.round(seeded(back) * 90);
    const score = bad ? 38 + Math.round(seeded(back * 2) * 14) : 68 + Math.round(seeded(back * 3) * 26);
    out.push({
      date: offsetToIso(-back, now),
      durationMin,
      score,
      restingHr: 46 + Math.round(seeded(back * 4) * 8) + (bad ? 4 : 0),
      source: 'health',
    });
  }
  return out;
}

// --- Weight: sampled every 2–3 days over ~6 weeks with normal daily noise. ---
export function weight(now = new Date()) {
  const out = [];
  const base = 52.4;
  for (let back = 42; back >= 0; back -= 2 + (seeded(back) < 0.5 ? 0 : 1)) {
    const drift = (42 - back) * 0.012; // gentle upward growth trend
    const noise = (seeded(back * 13) - 0.5) * 0.9;
    out.push({ date: offsetToIso(-back, now), kg: Math.round((base + drift + noise) * 10) / 10, source: 'health' });
  }
  return out;
}

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

// --- Seed goals (progress is computed from data, not stored here). ---
export function goals(now = new Date()) {
  return [
    { id: 'goal-1', title: 'Ride 6h/week consistently', type: 'consistency', target: '6 hours per week', metric: 'weekly_ride_hours', targetValue: 6, deadline: offsetToIso(56, now), createdAt: offsetToIso(-20, now), status: 'active' },
    { id: 'goal-2', title: 'Threshold power test PB', type: 'performance', target: 'Beat 210W 20-min test', metric: null, targetValue: 210, deadline: offsetToIso(40, now), createdAt: offsetToIso(-14, now), status: 'active' },
    { id: 'goal-3', title: 'No assignment submitted late', type: 'school', target: '0 late this term', metric: 'late_assignments', targetValue: 0, deadline: offsetToIso(70, now), createdAt: offsetToIso(-30, now), status: 'active' },
  ];
}

// --- Parsed WhatsApp plans awaiting confirmation (§3.3 review queue). ---
export function socialQueue(now = new Date()) {
  return [
    { id: 'soc-1', raw: 'yo bike park sunday? leaving like 9', who: 'Max, Leo', what: 'Bike park session', when: offsetToIso(4, now) + 'T09:00', where: 'Winterberg', status: 'pending', source: 'whatsapp' },
    { id: 'soc-2', raw: 'movie friday night?', who: 'Sofia', what: 'Cinema', when: offsetToIso(2, now) + 'T19:30', where: 'Zürich', status: 'pending', source: 'whatsapp' },
  ];
}

// --- Canned chat responses incl. tool calls (§5.1). Matched by keyword. ---
// Each entry is a list of assistant "steps": either {text} or {tool, input}.
// After a tool step the mock feeds the tool result back and continues.
export function chatResponses() {
  return [
    {
      match: ['training plan', 'training block', 'sophisticated', 'periodi', 'build a plan', 'build me a plan', 'structured plan', 'plan for my goal', 'plan for the goal', 'multi-week', '4 week', 'six week'],
      steps: [
        { text: "Let's build this around your threshold power-test goal, working back from the deadline. I'll set a 4-week block — a base week, two build weeks with intervals, then a taper — sized off your recent load. Want me to save it?" },
        { tool: 'set_training_block', input: { goalTitle: 'Threshold power test PB', weeksCount: 4, focus: 'Threshold' } },
        { text: 'Done — saved a 4-week threshold block linked to that goal. Week 1 settles you in, weeks 2–3 add the Thursday intervals, week 4 tapers before the test. It shows on the Training tab.' },
      ],
    },
    {
      match: ['fuelling', 'fueling', 'diet plan', 'meal plan', 'nutrition plan', 'eat to support', 'food plan', 'eating plan', 'fuel plan'],
      steps: [
        { text: "I'll frame this as a fuelling plan — how to eat to train and study well, not a restriction diet. It leans on more carbs around your big sessions and protein at every meal. Save it?" },
        { tool: 'set_fuelling_plan', input: { goalTitle: 'Ride 6h/week consistently' } },
        { text: "Saved a fuelling plan linked to your ride goal: extra carbs on big ride days, protein every meal, a recovery snack after hard sessions, and no skipping breakfast. It's on your Me tab." },
      ],
    },
    {
      match: ['goal', 'consistent', 'set a goal'],
      steps: [
        { text: "Sure — I'll set a consistency goal to ride 6 hours a week. Confirming and saving it now." },
        { tool: 'set_goal', input: { title: 'Ride 6h/week consistently', type: 'consistency', target: '6 hours per week', metric: 'weekly_ride_hours', targetValue: 6 } },
        { text: 'Done. Saved "Ride 6h/week consistently" as a consistency goal — progress will track from your Strava rides.' },
      ],
    },
    {
      match: ['thursday', 'easier', 'downgrade', 'tired'],
      steps: [
        { text: "You've had two rough nights, so easing Thursday makes sense. I'll drop it from threshold intervals to an endurance ride — want me to apply that?" },
        { tool: 'adjust_training_plan', input: { day: 'Thu', intensity: 'endurance', note: 'Eased after poor sleep' } },
        { text: "Updated Thursday to an endurance ride. I didn't touch the rest of the week." },
      ],
    },
    {
      match: ['study', 'essay', 'assignment', 'revise'],
      steps: [
        { text: "Let's protect time for the English essay before it's due. I'll drop a 60-minute study block into a free evening slot." },
        { tool: 'create_study_block', input: { assignmentTitle: 'English essay: Of Mice and Men', durationMin: 60 } },
        { text: 'Scheduled a 60-minute study block for the English essay and queued it to your calendar.' },
      ],
    },
    {
      match: ['weight', 'weigh', 'scale'],
      steps: [
        { text: 'Logged. Your 30-day trend is steady with normal day-to-day noise — nothing to read into a single number.' },
        { tool: 'log_entry', input: { kind: 'weight', value: 52.6 } },
        { text: 'Saved 52.6 kg to your trend line.' },
      ],
    },
    {
      match: ['eat', 'food', 'plate', 'lunch', 'dinner', 'meal'],
      steps: [
        { text: "Looks like rice, chicken and some salad — a solid base. You've got a long ride tomorrow, so you'll want more carbs than a normal day: add a banana or a slice of bread now and top up with a yoghurt this evening." },
      ],
    },
    {
      match: ['calendar', 'schedule tomorrow', 'plan my day'],
      steps: [
        { text: "Here's tomorrow: school 08:15–15:30, then your endurance ride at 16:30, and a 45-min study block for maths after dinner. I'll queue those to your calendar." },
        { tool: 'queue_calendar_change', input: { action: 'create', event: { title: 'Endurance ride', date: '+1', start: '16:30', durationMin: 90 } } },
        { text: 'Queued the ride to your calendar — it shows as pending until the sync job runs.' },
      ],
    },
  ];
}

// Default assistant reply when nothing matches.
export const CHAT_FALLBACK = {
  steps: [
    { text: "I'm running on demo data right now, so I can talk through your training, school, sleep and food, and I can set goals, adjust sessions, log entries and queue calendar changes. What do you want to look at?" },
  ],
};
