// Poll Strava for recent activities → data/strava-activities.json (§2). We poll
// (not webhooks) because webhooks need a public callback URL. Idempotent: merges
// by activity id.
import { readJSON, writeJSON, recordStatus, refreshAccessToken } from './lib.mjs';

const OUT = 'data/strava-activities.json';

const SPORT_TO_TYPE = { Ride: 'ride', MountainBikeRide: 'ride', VirtualRide: 'ride', Run: 'run', Workout: 'gym', WeightTraining: 'gym' };

async function main() {
  const tok = await refreshAccessToken({
    tokenUrl: 'https://www.strava.com/oauth/token',
    clientId: process.env.STRAVA_CLIENT_ID,
    clientSecret: process.env.STRAVA_CLIENT_SECRET,
    refreshToken: process.env.STRAVA_REFRESH_TOKEN,
  });
  const res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', { headers: { Authorization: `Bearer ${tok.access_token}` } });
  if (!res.ok) throw new Error(`strava ${res.status}`);
  const raw = await res.json();

  const mapped = raw.map((a) => ({
    id: `strava-${a.id}`,
    date: (a.start_date_local || a.start_date).slice(0, 10),
    type: SPORT_TO_TYPE[a.sport_type || a.type] || 'gym',
    sport: a.sport_type || a.type,
    durationMin: Math.round((a.moving_time || 0) / 60),
    distanceM: Math.round(a.distance || 0),
    climbingM: Math.round(a.total_elevation_gain || 0),
    source: 'strava',
  }));

  const existing = await readJSON(OUT, { activities: [] });
  const byId = new Map(existing.activities.map((a) => [a.id, a]));
  for (const a of mapped) byId.set(a.id, a);
  const merged = [...byId.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  await writeJSON(OUT, { activities: merged, updatedAt: new Date().toISOString() });
  await recordStatus('strava', true);
  console.log(`strava: ${mapped.length} fetched, ${merged.length} total`);
}

main().catch(async (err) => {
  await recordStatus('strava', false, err);
  console.error(err);
  process.exit(1);
});
