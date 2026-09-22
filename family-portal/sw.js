/**
 * Family Portal service worker.
 *
 *  - Precaches the whole app shell on install, so the installed app starts
 *    with no connection.
 *  - Page navigations: network first, then the cached shell, then offline.html.
 *  - Same-origin assets: stale-while-revalidate.
 *  - CDN modules and Google Fonts: stale-while-revalidate in a runtime cache.
 *  - Supabase (Auth, REST, Realtime) and anything else: never cached.
 *
 * Bump VERSION whenever you deploy changed files; the app then offers an
 * "Update" button that activates the new worker.
 */
const VERSION = 'v1.0.0';
const SHELL_CACHE = `family-portal-shell-${VERSION}`;
const RUNTIME_CACHE = 'family-portal-runtime';
const RUNTIME_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

const SHELL = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/pages.css',
  './css/games.css',
  './js/app.js',
  './js/config.js',
  './js/backend/index.js',
  './js/backend/local.js',
  './js/backend/supabase.js',
  './js/core/bus.js',
  './js/core/icons.js',
  './js/core/notify.js',
  './js/core/pwa.js',
  './js/core/store.js',
  './js/core/sync.js',
  './js/core/ui.js',
  './js/core/utils.js',
  './js/data/avatars.js',
  './js/data/catalog.js',
  './js/games/registry.js',
  './js/games/battleships.js',
  './js/games/battleships-rules.js',
  './js/games/pool.js',
  './js/games/pool-engine.js',
  './js/games/poker.js',
  './js/games/poker-rules.js',
  './js/three/lobby3d.js',
  './js/three/decorations.js',
  './js/views/auth.js',
  './js/views/calendar.js',
  './js/views/chat.js',
  './js/views/games.js',
  './js/views/hub.js',
  './js/views/kudos.js',
  './js/views/match.js',
  './js/views/news.js',
  './js/views/profile.js',
  './js/views/shop.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('family-portal-shell-') && key !== SHELL_CACHE)
      .map((key) => caches.delete(key)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: false });
  const network = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || new Response('', { status: 504, statusText: 'Offline' });
}

async function handleNavigation(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    const response = await fetch(event.request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put('./index.html', response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match('./index.html')) || (await cache.match('./')) || (await cache.match('./offline.html'));
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(handleNavigation(event));
      return;
    }
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }

  if (RUNTIME_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '#/hub';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).pathname.startsWith(new URL(self.registration.scope).pathname));
    if (existing) {
      await existing.focus();
      existing.postMessage({ type: 'NAVIGATE', url: target });
      return;
    }
    await self.clients.openWindow(`${self.registration.scope}${target}`);
  })());
});
