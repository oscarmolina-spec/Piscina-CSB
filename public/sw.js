const CACHE_NAME = 'piscina-static-v2';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-pwa.png',
  '/images/escudo-color.png',
  '/images/escudo-blanco.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Nunca interceptamos APIs externas (Firebase Auth, Firestore, Google APIs)
  if (url.origin !== self.location.origin) return;

  const esRecursoEstatico =
    request.mode === 'navigate' ||
    /\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?|json)$/i.test(url.pathname);
  if (!esRecursoEstatico) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copia = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copia)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || (request.mode === 'navigate' ? caches.match('/') : undefined)))
  );
});
