/* Offline support: the app shell is cached; data files are fetched fresh and fall back to cache. */
const VERSION = 'invest-v1';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png',
  'js/catalog.js', 'js/content.js', 'js/util.js', 'js/store.js', 'js/data.js', 'js/charts.js', 'js/tv.js', 'js/ui.js',
  'js/views/markets.js', 'js/views/explore.js', 'js/views/asset.js', 'js/views/watchlist.js', 'js/views/portfolio.js',
  'js/views/more.js', 'js/views/tools.js', 'js/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const isData = url.pathname.includes('/data/');
  if (isData) {
    // Network first so prices are as fresh as possible; cache as a fallback when offline.
    e.respondWith(fetch(e.request).then((res) => {
      const copy = res.clone();
      if (res.ok) caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request)));
    return;
  }
  // App shell: serve from cache, refresh in the background.
  e.respondWith(caches.match(e.request).then((hit) => {
    const net = fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
