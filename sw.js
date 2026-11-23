/* Linguarium service worker.
 *
 * Strategy:
 *   - The app shell (documents, scripts, styles, icons) is precached so the
 *     application opens offline.
 *   - User data lives in IndexedDB, cached by the app itself - the service
 *     worker deliberately does NOT cache /api/* responses (they are
 *     user-specific and must never be served stale).
 *   - The build script appends a content hash line below, so every deploy
 *     byte-changes this file, triggers the update flow (skipWaiting +
 *     clients.claim) and refreshes the precache.
 */

const VERSION = 'linguarium-static-v1';
// build-stamp: placeholder

const PRECACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/app.css',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Background Sync (phase 2): the app registers 'linguarium-flush' whenever
// the offline queue grows. When connectivity returns, the browser fires this
// event; we wake any open client and tell it to flush its queue. (When no
// client is open, the queue simply waits for the next app open + 'online'
// listener, which has always worked.)
self.addEventListener('sync', (syncEvent) => {
  if (syncEvent.tag !== 'linguarium-flush') return;
  syncEvent.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'flush-queue' });
      }
    })(),
  );
});

self.addEventListener('message', (msgEvent) => {
  if (msgEvent.data?.type === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never touch the API: user data is cached in IndexedDB by the app,
  // with explicit offline-sync rules - not via a stale HTTP cache.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) {
    return;
  }

  if (event.request.mode === 'navigate') {
    // Network-first for navigation, offline fallback to the cached shell.
    event.respondWith(
      (async () => {
        try {
          return await fetch(event.request);
        } catch {
          const cache = await caches.open(VERSION);
          return (await cache.match('/index.html')) ?? (await cache.match('/')) ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (event.request.destination === 'script' || event.request.destination === 'style' || url.pathname.startsWith('/icons/')) {
    // Cache-first for static assets.
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        const hit = await cache.match(event.request);
        if (hit) return hit;
        try {
          const res = await fetch(event.request);
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        } catch {
          return hit ?? Response.error();
        }
      })(),
    );
  }
});
