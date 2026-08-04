// Central configuration and constants. No DOM access here — safe to import in Node.

export const USER = {
  age: 14,
  descriptor: 'a mountain biker and student',
};

// Data files that live in the private life-balancer-data repo under /data.
// In mock mode these are backed by localStorage/memory, seeded from fixtures.
export const DATA_FILES = {
  trainingPlan: 'data/training-plan.json',
  goals: 'data/goals.json',
  plans: 'data/plans.json', // goal-linked training blocks + fuelling plans
  calendarQueue: 'data/calendar-queue.json',
  logs: 'data/logs.json',
  studyBlocks: 'data/study-blocks.json',
  socialQueue: 'data/social-queue.json',
  syncStatus: 'data/sync-status.json',
};

export const INTEGRATIONS = ['anthropic', 'github', 'calendar', 'strava', 'health', 'schoology'];

// Garmin-Connect-style palette (§4). Never red for health.
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

// The nutrition rules from §3.5. These are injected VERBATIM into the Anthropic
// system prompt and are also mirrored in CLAUDE.md so they survive future edits.
// Do not soften or paraphrase these.
export const NUTRITION_RULES = `NUTRITION RULES (non-negotiable — the user is 14 and still growing; this feature supports fuelling for sport and school, never restriction):
- Frame all feedback around adequacy and performance: "you'll want more carbs before tomorrow's ride", "add a protein source here".
- Do NOT display calorie targets, calorie deficits, or macro percentage goals.
- Do NOT set, suggest, or track a goal weight. Scale photos log a number and a trend line, nothing more.
- Do NOT rank foods as good/bad, or use language like "cheat meal", "earned", or "burn off".
- Never link food intake to exercise output in the same view or sentence.
- If input suggests skipped meals or restriction, surface a gentle prompt to talk to a parent or coach — not a plan adjustment.`;

export function buildSystemPrompt() {
  return [
    `You are the assistant inside "Life Balancer", a personal life-planning app for a single user.`,
    `The user is ${USER.age} years old and is ${USER.descriptor}.`,
    `Be direct and brief. Answer in a few sentences. Do not write essays.`,
    `You have tools to read history and to write goals, training-plan changes, logs, calendar changes, and study blocks.`,
    `Any tool that writes must state what it changed in plain language afterwards.`,
    `Changes to the training plan or goals require explicit confirmation in the conversation first. Never silently rewrite the week.`,
    `Goal progress is always computed from real synced data, never asserted by you.`,
    ``,
    `GOAL-DRIVEN PLANNING:`,
    `- Goals are the anchor. When the user wants a richer plan, tie it to a goal (create one with set_goal first if needed) and reference the goal's target and deadline.`,
    `- Use set_training_block to build a structured, progressive multi-week training block (each week has a focus and its sessions). Work back from the goal's deadline: build base first, then intensity, then a taper. Base it on the user's real recent load and sleep from the snapshot; don't overreach after poor sleep.`,
    `- Use set_fuelling_plan for food guidance. A fuelling plan is guidance for eating to support training and school — NOT a diet. It must obey every nutrition rule below: frame everything around adequacy and performance (more carbs before big sessions, protein at each meal, recovery snacks), and never include calorie targets, macros as percentages, a goal weight, or good/bad food language.`,
    `- After giving feedback on a meal photo, record a one-line note with log_entry (kind "nutrition") so it appears on the Food page. Read a scale photo's number and log it with log_entry (kind "weight") — number and trend only.`,
    `- Confirm training-block and goal changes in the conversation before writing.`,
    ``,
    NUTRITION_RULES,
  ].join('\n');
}

// Training intensity ordering used for load and downgrade suggestions.
export const INTENSITY = { recovery: 1, easy: 2, endurance: 3, tempo: 4, threshold: 5, hard: 6, race: 7 };

// Conflict priority for the Balancer (§3.7): school deadlines > confirmed social > training > optional study.
export const BALANCER_PRIORITY = ['school', 'social', 'training', 'study'];
