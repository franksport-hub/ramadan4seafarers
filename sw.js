const CACHE_NAME = 'islam-at-sea-v1';

// Basisbestanden die altijd direct offline beschikbaar moeten zijn
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon-192.png' // Zorg dat je een icoontje hebt met deze naam!
];

// 1. INSTALLATIE: Download de basisbestanden naar de telefoon
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] App Shell wordt opgeslagen voor offline gebruik');
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// 2. ACTIVATIE: Verwijder oude versies als je de app updatet
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Oude cache verwijderd:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. FETCH: Onderschep internetverkeer (De offline magie)
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Scenario A: De externe API (sunrise-sunset.org)
    if (url.hostname === 'api.sunrise-sunset.org') {
        event.respondWith(
            // Probeer eerst live internet (Network-first)
            fetch(event.request)
                .then((networkResponse) => {
                    // Gelukt? Sla een kopie op voor als we offline gaan
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    // Geen internet? Pak de laatst bekende data uit de opslag
                    console.log('[Service Worker] Geen internet. API fallback aangesproken.');
                    return caches.match(event.request);
                })
        );
    } 
    // Scenario B: Alle andere bestanden (HTML, React scripts, Tailwind, etc.)
    else {
        event.respondWith(
            // Kijk eerst in de cache (Cache-first)
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse; // Direct laten zien
                }
                
                // Niet in cache? Download het en bewaar het direct voor de volgende keer
                return fetch(event.request).then((networkResponse) => {
                    // Check of het een geldig bestand is
                    if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
                        return networkResponse;
                    }

                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                }).catch(() => {
                    console.log('[Service Worker] Verzoek gefaald, volledig offline.');
                });
            })
        );
    }
});
