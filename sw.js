const CACHE_NAME = 'Islam at sea - V1';

// Deze bestanden worden direct gedownload en bewaard voor offline gebruik
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// Installatie: Sla de basisbestanden op in de cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Bestanden worden gecached');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

// Activatie: Ruim oude caches op als er een update is
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Oude cache verwijderd', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Bepaal wat er gebeurt als de app data opvraagt (met of zonder internet)
self.addEventListener('fetch', (event) => {
  // We slaan API calls naar de zonnetijden over, want die moeten altijd live berekend worden
  if (event.request.url.includes('api.sunrise-sunset.org')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // 1. Geef de opgeslagen versie terug als we die hebben (Offline of snel laden)
        if (cachedResponse) {
          return cachedResponse;
        }

        // 2. Als we het niet hebben, haal het dan van het internet
        return fetch(event.request).then((networkResponse) => {
          // Controleer of de response geldig is, zo ja: bewaar hem voor de volgende keer
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            // Externe scripts (zoals React en Tailwind) bewaren we ook voor offline gebruik
            if (event.request.url.startsWith('http') && event.request.method === 'GET') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return networkResponse;
        }).catch(() => {
          // Als we offline zijn en de file is niet gecached, doe dan niets (of geef een offline pagina)
          console.log('Je bent offline en de data is niet lokaal beschikbaar.');
        });
      })
  );
});
