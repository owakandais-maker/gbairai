/**
 * Service worker — app shell precache + runtime strategies.
 *
 * - App shell (HTML/CSS/JS/manifest): stale-while-revalidate, so a new deploy
 *   is picked up on the next visit without ever blocking on the network.
 * - Fonts and icon CSS: cache-first with a long TTL.
 * - Remote images: cache-first, capped at 60 entries (LRU-ish trim).
 * - Everything else: network, falling back to cache, falling back to the shell.
 */

const VERSION = 'v2.0.1';
const SHELL = `gbairai-shell-${VERSION}`;
const ASSETS = `gbairai-assets-${VERSION}`;
const IMAGES = `gbairai-images-${VERSION}`;
const MAX_IMAGES = 60;

const SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/app.js',
  './assets/js/dom.js',
  './assets/js/store.js',
  './assets/js/i18n.js',
  './assets/js/data.js',
  './assets/js/ui.js',
  './assets/js/ai.js',
  './assets/js/views.js',
  './assets/js/features.js',
  './assets/js/icons.js',
  './assets/icons/icon.svg',
];

/**
 * Cross-origin assets worth having before the first offline visit. Precached
 * here because the worker is not yet controlling the page during the very first
 * load, so the runtime handler never sees these requests.
 */
const EXTERNAL_URLS = [
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // addAll fails the whole install if any single URL 404s, so add individually.
    await Promise.all(SHELL_URLS.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => null)));

    const assets = await caches.open(ASSETS);
    await Promise.all(EXTERNAL_URLS.map(async (url) => {
      try {
        // `no-cors` keeps this working for opaque font-CSS responses.
        const res = await fetch(url, { mode: 'no-cors', cache: 'reload' });
        if (res) await assets.put(url, res);
      } catch { /* the app degrades to the system font stack */ }
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL, ASSETS, IMAGES]);
    const names = await caches.keys();
    await Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i += 1) await cache.delete(keys[i]);
}

/**
 * A real Response, so a cache miss shows as a handled fallback rather than a
 * console network error. Images get a neutral placeholder tile so the layout
 * keeps its shape offline instead of showing broken-image glyphs.
 */
const PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9" width="16" height="9">' +
  '<rect width="16" height="9" fill="#e9ebf0"/></svg>';

function offlineResponse(request) {
  if (request.destination === 'image') {
    return new Response(PLACEHOLDER_SVG, {
      status: 200,
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
    });
  }
  if (request.destination === 'style') {
    // Valid, empty CSS: the browser falls back to the system font stack
    // instead of logging an aborted stylesheet.
    return new Response('/* offline */', {
      status: 200,
      headers: { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  return new Response('Offline', {
    status: 504,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => { if (res && res.ok) cache.put(request, res.clone()); return res; })
    .catch(() => null);
  return cached || (await network) || offlineResponse(request);
}

async function cacheFirst(request, cacheName, { max } = {}) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    // Opaque cross-origin responses still cache usefully for fonts/images.
    if (res && (res.ok || res.type === 'opaque')) {
      await cache.put(request, res.clone());
      if (max) trim(cacheName, max);
    }
    return res;
  } catch {
    return cached || offlineResponse(request);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch { return; }
  if (!/^https?:$/.test(url.protocol)) return;

  const sameOrigin = url.origin === self.location.origin;

  // Navigations: serve the shell so deep links work offline.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(request);
        const cache = await caches.open(SHELL);
        cache.put('./index.html', res.clone());
        return res;
      } catch {
        const cache = await caches.open(SHELL);
        return (await cache.match('./index.html')) || (await cache.match('./')) || offlineResponse(request);
      }
    })());
    return;
  }

  if (sameOrigin) {
    event.respondWith(staleWhileRevalidate(request, SHELL));
    return;
  }

  if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    event.respondWith(cacheFirst(request, ASSETS));
    return;
  }

  if (request.destination === 'image' || /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGES, { max: MAX_IMAGES }));
  }
});
