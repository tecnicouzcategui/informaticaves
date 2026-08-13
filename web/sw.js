// ============================================================
// sw.js — Service Worker PWA (Network-first, JS always fresh)
// ============================================================
const CACHE_NAME = 'ives-cache-v21';
// Solo cachear assets estáticos (imágenes, íconos, CSS)
// Los archivos .js y .html siempre se buscan en la red primero
const STATIC_ASSETS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/logo_oficial.png',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Ignorar peticiones que no sean GET o que sean de Firebase/APIs externas
  if (event.request.method !== 'GET') return;
  if (url.includes('firestore.googleapis.com')) return;
  if (url.includes('gstatic.com')) return;
  if (url.includes('googleapis.com')) return;

  // Los archivos .js y .html SIEMPRE van a la red primero
  // Solo si la red falla, se sirve desde caché (offline fallback)
  if (url.endsWith('.js') || url.endsWith('.html') || url.includes('.html?')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // Actualizar caché con la versión nueva
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Para otros assets (CSS, imágenes): cache-first con fallback a red
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        return res;
      });
    })
  );
});

