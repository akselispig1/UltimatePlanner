// Service worker (§1.0 offline-first, §5.3 "renders offline"). Precache the full
// app shell + every ES module so a cold offline launch renders from cache, plus
// runtime-cache anything else same-origin. Cache-first; navigations fall back to
// the cached index.html.

const CACHE = 'life-balancer-v1';

const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  // app modules
  './src/main.js',
  './src/config.js',
  './src/keys.js',
  './src/github.js',
  './src/storage.js',
  './src/schemas.js',
  './src/seed.js',
  './src/fixtures.js',
  './src/context.js',
  './src/app-data.js',
  './src/chat.js',
  './src/tools.js',
  './src/util/dates.js',
  './src/util/id.js',
  './src/util/kv.js',
  './src/ui/dom.js',
  './src/ui/image.js',
  './src/adapters/index.js',
  './src/adapters/strava/mock.js',
  './src/adapters/strava/live.js',
  './src/adapters/health/mock.js',
  './src/adapters/health/live.js',
  './src/adapters/schoology/mock.js',
  './src/adapters/schoology/live.js',
  './src/adapters/calendar/mock.js',
  './src/adapters/calendar/live.js',
  './src/adapters/anthropic/mock.js',
  './src/adapters/anthropic/live.js',
  './src/features/schedule.js',
  './src/features/school.js',
  './src/features/training.js',
  './src/features/recovery.js',
  './src/features/nutrition.js',
  './src/features/calendar-queue.js',
  './src/features/goals.js',
  './src/features/balancer.js',
  './src/views/chat.js',
  './src/views/settings.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never cache API calls

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'offline' });
        });
    })
  );
});
