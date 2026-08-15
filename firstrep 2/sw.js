/* FIRST REP — service worker.
 * The whole app is precached. No training path ever touches the network,
 * so there is no runtime caching strategy to get wrong.
 *
 * Bump CACHE and BUILD in js/app.js together.
 *
 * CORE must cache or the install fails — those files are the app. ASSETS are
 * cached best-effort: a missing font falls back to the system face (they are
 * declared font-display:swap) and a missing icon only affects the install
 * prompt. Before, one absent file rejected addAll, the install failed, and the
 * old worker kept serving the old build with no visible reason why.
 */
const CACHE = 'firstrep-v3';
const CORE = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/engine.js', 'js/db.js', 'js/screening.js', 'js/exercises.js'
];
const ASSETS = [
  'fonts/archivo-exp.woff2', 'fonts/plex-sans-400.woff2', 'fonts/plex-sans-600.woff2',
  'fonts/plex-mono-500.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(CORE);
    await Promise.allSettled(ASSETS.map(a => c.add(a)));
    return self.skipWaiting();
  }));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true })
      .then(hit => hit || fetch(e.request).catch(() => caches.match('index.html')))
  );
});
