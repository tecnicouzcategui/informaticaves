// ============================================================
// sw.js — Service Worker PWA (Desactivado temporalmente en local)
// ============================================================

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
