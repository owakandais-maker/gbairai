/* ==========================================================================
   sw.js — service worker de GBAIRAI ZONE
   Coquille applicative mise en cache, réseau d'abord pour la navigation,
   cache d'abord pour les ressources. Les polices distantes sont mises en
   cache à la volée, et leur absence ne bloque jamais l'application.
   ========================================================================== */

const VERSION = 'gbzn-v1';
const SHELL = VERSION + '-shell';
const RUNTIME = VERSION + '-runtime';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/base.css',
  './assets/css/views.css',
  './assets/js/app.js',
  './assets/js/core/dom.js',
  './assets/js/core/store.js',
  './assets/js/core/router.js',
  './assets/js/core/i18n.js',
  './assets/js/core/icons.js',
  './assets/js/core/ui.js',
  './assets/js/core/media.js',
  './assets/js/core/search.js',
  './assets/js/core/actions.js',
  './assets/js/core/idb.js',
  './assets/js/data/seed.js',
  './assets/js/data/world.js',
  './assets/js/data/demoMedia.js',
  './assets/js/features/globe.js',
  './assets/js/features/agent.js',
  './assets/js/features/parts.js',
  './assets/js/views/home.js',
  './assets/js/views/shorts.js',
  './assets/js/views/profile.js',
  './assets/js/views/messages.js',
  './assets/js/views/live.js',
  './assets/js/views/shop.js',
  './assets/js/views/misc.js',
  './assets/js/views/settings.js',
  './assets/js/views/owner.js',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // Un fichier manquant ne doit pas faire échouer l'installation entière.
    await Promise.all(SHELL_FILES.map(async (url) => {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch (e) { /* ressource optionnelle */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

function isShellRequest(url) {
  return url.origin === self.location.origin;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Navigation : on sert la coquille, l'application gère le routage par hash.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        const cache = await caches.open(SHELL);
        cache.put('./index.html', net.clone()).catch(() => {});
        return net;
      } catch (e) {
        const cached = await caches.match('./index.html');
        return cached || new Response('<h1>GBAIRAI ZONE</h1><p>Hors ligne.</p>', {
          status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
    })());
    return;
  }

  // Ressources locales : cache d'abord, réseau en secours.
  if (isShellRequest(url)) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) {
        // rafraîchissement discret en arrière-plan
        fetch(req).then((net) => {
          if (net && net.ok) caches.open(SHELL).then((c) => c.put(req, net.clone()).catch(() => {}));
        }).catch(() => {});
        return cached;
      }
      try {
        const net = await fetch(req);
        if (net && net.ok) {
          const cache = await caches.open(SHELL);
          cache.put(req, net.clone()).catch(() => {});
        }
        return net;
      } catch (e) {
        return new Response('', { status: 504, statusText: 'Hors ligne' });
      }
    })());
    return;
  }

  // Polices et ressources distantes : réseau puis cache, sans jamais bloquer.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const net = await fetch(req);
      if (net && (net.ok || net.type === 'opaque')) {
        const cache = await caches.open(RUNTIME);
        cache.put(req, net.clone()).catch(() => {});
      }
      return net;
    } catch (e) {
      return new Response('', { status: 504, statusText: 'Hors ligne' });
    }
  })());
});
