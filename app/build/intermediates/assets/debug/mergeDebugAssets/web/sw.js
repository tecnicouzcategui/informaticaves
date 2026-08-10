// ============================================================
// sw.js — Service Worker PWA (Offline Cache)
// InformaticaVES | El Técnico Luis
// ============================================================

const CACHE_NAME  = 'ives-v1.2';
const ASSETS_CORE = [
  '/',
  '/index.html',
  '/servicios.html',
  '/solicitud.html',
  '/style.css',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Fira+Code:wght@400;500;600&display=swap',
];

// ── Instalación: pre-cachear assets core ─────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_CORE);
    }).catch(err => console.warn('[SW] Error en cache install:', err))
  );
  self.skipWaiting();
});

// ── Activación: limpiar caches viejos ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(n => n !== CACHE_NAME)
          .map(n => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: Cache-first para assets, Network-first para APIs ───
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // No interceptar peticiones a Firebase, Telegram API, Google Auth
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('telegram.org') ||
    url.hostname.includes('wa.me') ||
    url.pathname.startsWith('/admin')
  ) {
    return; // Dejar que el navegador maneje normalmente
  }

  // Solo interceptar GET
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        // Solo cachear respuestas exitosas de mismo origen
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        if (!url.origin.includes(self.location.origin)) {
          return response;
        }

        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, toCache));
        return response;
      }).catch(() => {
        // Si estamos offline y no hay cache, devolver página offline
        if (request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
