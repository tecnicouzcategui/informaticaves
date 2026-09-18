// ============================================================
// sw.js — Service Worker PWA (Network-first, JS always fresh)
// ============================================================
const CACHE_NAME = 'informaticosvenezuela-cache-v51';
// Solo cachear assets estáticos (imágenes, íconos, CSS)
// Los archivos .js, .css y .html siempre se buscan en la red primero
const STATIC_ASSETS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
  '/logo_oficial.svg',
  '/logo_emblem.svg',
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

  // Los archivos .js, .css y .html SIEMPRE van a la red primero
  // Solo si la red falla, se sirve desde caché (offline fallback)
  if (url.endsWith('.js') || url.endsWith('.html') || url.endsWith('.css') || url.includes('.html?') || url.includes('.css?') || url.includes('.js?')) {
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

// ── Recepción de Notificaciones Push con Vibración ─────────────
self.addEventListener('push', event => {
  let payload = {
    title: 'Informáticos Venezuela',
    body: 'Nueva actualización de asistencia técnica',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: '/tecnico.html' }
  };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    vibrate: [400, 150, 400, 150, 600],
    data: payload.data || { url: '/tecnico.html' },
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

