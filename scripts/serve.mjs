// Minimal static file server (no dependencies). Serves the PWA with correct MIME
// types for ES modules. Used by `npm start` and by the check harness.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, normalize, extname, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export function startServer(port = 0) {
  const server = createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname === '/') pathname = '/index.html';
      const filePath = normalize(join(ROOT, pathname));
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      let target = filePath;
      try {
        const s = await stat(target);
        if (s.isDirectory()) target = join(target, 'index.html');
      } catch {
        // For SPA navigations to unknown paths, fall back to index.html.
        target = join(ROOT, 'index.html');
      }
      const body = await readFile(target);
      const headers = { 'Content-Type': MIME[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' };
      if (extname(target) === '.js' || target.endsWith('sw.js')) headers['Service-Worker-Allowed'] = '/';
      res.writeHead(200, headers).end(body);
    } catch (err) {
      res.writeHead(404).end('Not found');
    }
  });
  return new Promise((resolvePromise) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      resolvePromise({ server, port: addr.port, url: `http://127.0.0.1:${addr.port}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

// CLI mode
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 5173;
  const { url } = await startServer(port);
  console.log(`Life Balancer running at ${url}`);
}
