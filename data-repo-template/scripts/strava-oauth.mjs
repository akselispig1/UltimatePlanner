// One-off LOCAL helper to get a Strava refresh token. Run on your own machine.
// Create an API app at https://www.strava.com/settings/api with Authorization
// Callback Domain "localhost".
//
//   STRAVA_CLIENT_ID=... STRAVA_CLIENT_SECRET=... node scripts/strava-oauth.mjs
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REDIRECT = 'http://localhost:8711/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET');
  process.exit(1);
}

const authUrl =
  'https://www.strava.com/oauth/authorize?' +
  new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: 'code', approval_prompt: 'force', scope: 'activity:read_all' });

console.log('\nOpen this URL and authorise:\n\n' + authUrl + '\n');

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8711');
  const code = url.searchParams.get('code');
  if (!code) {
    res.end('no code');
    return;
  }
  const tok = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, grant_type: 'authorization_code' }),
  }).then((r) => r.json());
  res.end('Done — return to your terminal.');
  console.log('\nSTRAVA_REFRESH_TOKEN=' + tok.refresh_token + '\n');
  server.close();
  process.exit(0);
});
server.listen(8711);
createInterface({ input: process.stdin });
