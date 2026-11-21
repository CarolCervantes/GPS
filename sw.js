/**
 * DiaMon — Service Worker de Monitoreo Clínico y Alertas 24/7
 * Garantiza recepción de notificaciones en segundo plano, soporte offline
 * y alertas críticas de salud en Cartagena de Indias.
 */

const CACHE_NAME = 'diamon-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/css/dashboard-modern.css',
  '/assets/css/alertas-sistema.css',
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

// Manejo de eventos Push en segundo plano (24/7)
self.addEventListener('push', (event) => {
  let data = {
    title: '⚠️ DiaMon: Alerta de Salud 24/7',
    body: 'Se ha detectado una incidencia médica o de geocerca en Cartagena.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [300, 100, 300, 100, 300],
    data: { url: '/index.html#view-alertas' }
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

// Mensajes enviados desde la pestaña activa
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const payload = event.data.payload || {};
    self.registration.showNotification(payload.title || '⚠️ Alerta Médica DiaMon', {
      body: payload.body || 'Notificación del sistema 24/7.',
      icon: payload.icon || '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [300, 100, 300],
      tag: 'diamon-alerta-local',
      renotify: true,
      data: { url: payload.url || '/index.html#view-alertas' }
    });
  }
});

// Clic en notificación: enfocar ventana o abrir la vista de alertas
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/index.html#view-alertas';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
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
