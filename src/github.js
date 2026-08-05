// Minimal GitHub Contents API client (§1.3). Used as the live storage backend
// and to verify the PAT on the setup screen. Reads/writes single JSON files in
// the private life-balancer-data repo. Retries transient failures (§6).

const API = 'https://api.github.com';

function b64encode(str) {
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
  return Buffer.from(str, 'utf8').toString('base64');
}
function b64decode(str) {
  if (typeof atob === 'function') return decodeURIComponent(escape(atob(str)));
  return Buffer.from(str, 'base64').toString('utf8');
}

async function withRetry(fn, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw lastErr;
}

export function githubClient({ token, repo }) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  async function getFile(path) {
    return withRetry(async () => {
      const res = await fetch(`${API}/repos/${repo}/contents/${path}`, { headers });
      if (res.status === 404) return { content: null, sha: null };
      if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status}`);
      const json = await res.json();
      return { content: b64decode(json.content), sha: json.sha };
    });
  }

  async function putFile(path, content, message) {
    const { sha } = await getFile(path);
    return withRetry(async () => {
      const res = await fetch(`${API}/repos/${repo}/contents/${path}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ message, content: b64encode(content), sha: sha || undefined }),
      });
      if (!res.ok) throw new Error(`GitHub PUT ${path}: ${res.status}`);
      return res.json();
    });
  }

  // Confirms the token can read the repo — the setup screen's one-line test.
  async function verify() {
    const res = await fetch(`${API}/repos/${repo}`, { headers });
    return res.ok;
  }

  return { getFile, putFile, verify };
}
