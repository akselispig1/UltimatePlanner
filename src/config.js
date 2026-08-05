// Central configuration and constants. No DOM access — safe to import in Node.

export const USER = {
  age: 14,
  descriptor: 'mountain biker and student',
};

// Data files that live in the private life-balancer-data repo under /data.
// In mock mode these are backed by localStorage/memory, seeded from fixtures.
// The app is a calendar scheduler, so the surface is deliberately small.
export const DATA_FILES = {
  trainingPlan: 'data/training-plan.json',
  calendarQueue: 'data/calendar-queue.json',
  studyBlocks: 'data/study-blocks.json',
  syncStatus: 'data/sync-status.json',
};

export const INTEGRATIONS = ['anthropic', 'github', 'calendar', 'strava', 'schoology'];

// Garmin-Connect-style palette. Never red for anything health-related.
export const THEME = {
  bg: '#000000',
  card: '#1C1C1E',
  border: '#2C2C2E',
  accent: '#00A9E0',
  teal: '#00D4AA',
  amber: '#FFB800',
  text: '#FFFFFF',
  muted: '#8E8E93',
};

// The assistant has one job: put things on the user's Google Calendar.
export function buildSystemPrompt() {
  return [
    `You are the assistant inside "Life Balancer", a personal scheduling app for a single user (a ${USER.age}-year-old ${USER.descriptor}).`,
    `Your one job is to put things on the user's Google Calendar: their training plan, their school assignments and study time, and any one-off events they ask for.`,
    `Be direct and brief — a sentence or two, never an essay.`,
    `Tools you have:`,
    `- adjust_training_plan — edit a day of the weekly training plan.`,
    `- add_training_to_calendar — push the training plan's sessions onto the calendar for the week(s) ahead.`,
    `- add_assignments_to_calendar — put open assignment due dates (and optional study blocks) onto the calendar.`,
    `- create_study_block — schedule study time for one specific assignment.`,
    `- queue_calendar_change — add, move, or delete a single one-off event.`,
    `Calendar writes are queued and a background job syncs them to Google Calendar. After any tool call, say plainly what you scheduled and that it will appear on Google Calendar.`,
    `Confirm changes to the training plan in the conversation before applying them.`,
  ].join('\n');
}
