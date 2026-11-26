// Service Worker de Monitoreo Clínico y Alertas 24/7
// Incluye estrategia Network-First con Fallback a Caché (Soporte Offline Real)
// y Notificaciones Push en segundo plano.
const CACHE_NAME = 'diamon-cache-v14';
const STATIC_ASSETS = [
  '/',
  '/pages/index.html',
  '/pages/login.html',
  '/pages/ficha-emergencia.html',
  '/pages/descargar-app.html',
  '/assets/css/dashboard-modern.css',
  '/assets/css/alertas-sistema.css',
  '/assets/js/caso-estudio.js',
  '/assets/js/alertas-sistema.js',
  '/assets/js/telemetria-dispositivo.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia Network-First con Fallback a Caché para soporte Offline real
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith(self.location.origin)) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('/pages/index.html');
        });
      })
  );
});

self.addEventListener('push', (event) => {
  let data = {
    title: '⚠️ DiaMon: Alerta de Salud 24/7',
    body: 'Se ha detectado una incidencia médica o de geocerca en Chapacuá, Cartagena.',
    icon: '/assets/icon-diamon.svg',
    badge: '/assets/icon-diamon.svg',
    vibrate: [300, 100, 300, 100, 300],
    data: { url: '/pages/index.html#view-alertas' }
  };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (_) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      vibrate: data.vibrate,
      tag: 'diamon-alerta-247',
      renotify: true,
      requireInteraction: true,
      data: data.data
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const payload = event.data.payload || {};
    self.registration.showNotification(payload.title || '⚠️ Alerta Médica DiaMon', {
      body: payload.body || 'Notificación del sistema 24/7.',
      icon: payload.icon || '/assets/icon-diamon.svg',
      badge: '/assets/icon-diamon.svg',
      vibrate: [300, 100, 300],
      tag: 'diamon-alerta-local',
      renotify: true,
      data: { url: payload.url || '/pages/index.html#view-alertas' }
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/pages/index.html#view-alertas';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('diamon') && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE_TAB', tab: 'alertas' });
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

