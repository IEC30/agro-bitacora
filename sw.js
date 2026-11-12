const CACHE_NAME = 'agrobitacora-shell-v3';

// Recursos estáticos del App Shell indispensables para operar offline
const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/auth.js',
  './js/app.js',
  './js/db.js',
  './js/geo.js',
  './js/camera.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png'
];

// 1. Fase de Instalación: Precarga atómica del App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Almacenando en caché el App Shell...');
      return cache.addAll(APP_SHELL_ASSETS);
    }).then(() => {
      // Forzar activación inmediata sin esperar a que el usuario cierre pestañas
      return self.skipWaiting();
    })
  );
});

// 2. Fase de Activación: Purga de cachés antiguas o desactualizadas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Eliminando caché obsoleta:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      // Tomar control inmediato de todas las páginas abiertas bajo el ámbito
      return self.clients.claim();
    })
  );
});

// 3. Fase de Fetch: Intercepción de peticiones de red
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Solo interceptar peticiones GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Estrategia Cache-First para recursos estáticos del mismo origen
  if (requestUrl.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // Si no está en caché, intentar obtenerlo de la red
        return fetch(event.request).then((networkResponse) => {
          // Si la respuesta es válida, clonar y guardar en caché dinámica
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Si falla la red y es una navegación HTML, retornar el App Shell
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
    return;
  }

  // Estrategia Network-First para APIs o llamadas a terceros
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response(JSON.stringify({
        error: 'Conexión a internet no disponible. Operación en espera.',
        offline: true
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    })
  );
});
