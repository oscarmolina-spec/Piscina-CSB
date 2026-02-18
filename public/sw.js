const CACHE_NAME = 'piscina-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Fuerza a que se active ya
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Toma el control de la web de inmediato
});

self.addEventListener('fetch', (event) => {
  // Estrategia: Intentar red, si falla, buscar en caché
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});