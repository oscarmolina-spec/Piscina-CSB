const CACHE_NAME = 'piscina-app-v1';

// Archivos que queremos que funcionen sin internet (los básicos)
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instalar el Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Responder desde la caché si no hay internet
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});