// ============================================================
// sw.js — Service Worker PWA (Network-first strategy)
// ============================================================
const CACHE_NAME = 'ives-cache-v11';
const ASSETS = [
  '/',
  '/index.html',
  '/servicios.html',
  '/solicitud.html',
  '/mis-solicitudes.html',
  '/admin.html',
  '/style.css',
  '/logo_oficial.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
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
  // Ignorar peticiones que no sean GET o que sean de APIs/Firebase
  if (event.request.method !== 'GET' || event.request.url.includes('firestore.googleapis.com')) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
