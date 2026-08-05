// One-off LOCAL helper to get a Google refresh token. Run on your own machine,
// not in Actions. Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from a
// Desktop OAuth client (console.cloud.google.com → Credentials).
//
//   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/google-oauth.mjs
//
// It prints an auth URL; open it, approve, paste the code back, and it prints the
// refresh token to store as the GOOGLE_REFRESH_TOKEN Actions secret.
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT = 'http://localhost:8710/callback';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  process.exit(1);
}

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent' });

console.log('\nOpen this URL, approve, and you will be redirected back:\n\n' + authUrl + '\n');

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8710');
  const code = url.searchParams.get('code');
  if (!code) {
    res.end('no code');
    return;
  }
  const tok = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT, grant_type: 'authorization_code' }),
  }).then((r) => r.json());
  res.end('Done — return to your terminal.');
  console.log('\nGOOGLE_REFRESH_TOKEN=' + tok.refresh_token + '\n');
  server.close();
  process.exit(0);
});
server.listen(8710);
// Keep readline open so the process doesn't exit before the callback.
createInterface({ input: process.stdin });
