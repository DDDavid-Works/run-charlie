// Service worker: precaches the app shell so the game loads and plays offline.
// To ship an update, change CACHE_VERSION. The new worker installs in the
// background and takes over on the next page load (never mid-run).
const CACHE_VERSION = 'v22';
const CACHE_NAME = `runner-${CACHE_VERSION}`;

// Keep in sync with the files the pages load (tests/run.mjs checks this).
const PRECACHE = [
  './',
  'index.html',
  'privacy.html',
  'contact.html',
  'manifest.webmanifest',
  'styles/main.css',
  'scripts/main.js',
  'scripts/game.js',
  'scripts/config.js',
  'scripts/player.js',
  'scripts/background.js',
  'scripts/themes.js',
  'scripts/obstacles.js',
  'scripts/input.js',
  'scripts/storage.js',
  'scripts/format.js',
  'scripts/contact.js',
  'icons/favicon.svg',
  'icons/favicon-32.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // `reload` bypasses the HTTP cache so a new version never precaches stale files.
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('runner-') && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(
      (cached) =>
        cached ||
        fetch(request).catch(() =>
          // Offline and not cached: fall back to the game page for navigations.
          request.mode === 'navigate' ? caches.match('index.html') : Response.error()
        )
    )
  );
});
