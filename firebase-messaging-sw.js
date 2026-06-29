// ============================================================
//  firebase-messaging-sw.js  —  Service Worker para FCM
//  Gruppen🇩🇪  |  Solo messaging, SIN firestore (no funciona en SW)
// ============================================================

// 1. Importar SOLO los scripts necesarios en un Service Worker
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');
// ❌ NO importar firebase-firestore.js aquí — causa el error "not a function"

// 2. Configuración Firebase (igual que en index.html)
firebase.initializeApp({
  apiKey:            "AIzaSyA3GpW1N7i9YNdw7KtZXx5VFgWyWoyoBYM",
  authDomain:        "gruppende-94f00.firebaseapp.com",
  projectId:         "gruppende-94f00",
  storageBucket:     "gruppende-94f00.firebasestorage.app",
  messagingSenderId: "902209990512",
  appId:             "1:902209990512:web:eee7151f40ac41c70ba9b5",
  measurementId:     "G-WD6PVR87MR"
});

// 3. Obtener instancia de Messaging
const messaging = firebase.messaging();

// 4. Manejar notificaciones en segundo plano (app cerrada o minimizada)
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Notificación en segundo plano recibida:', payload);

  const titulo      = (payload.notification && payload.notification.title) || 'Gruppen🇩🇪';
  const opciones    = {
    body:    (payload.notification && payload.notification.body) || '',
    icon:    '/icon-192x192.png',
    badge:   '/icon-96x96.png',
    data:    payload.data || {},
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(titulo, opciones);
});

// 5. Abrir/enfocar la app al hacer clic en la notificación
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Si ya hay una pestaña abierta, enfocarla
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('gruppende.github.io') !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no hay pestaña abierta, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow('https://gruppende.github.io/Deutschland/');
      }
    })
  );
});

// 6. Activar el SW inmediatamente sin esperar recarga
self.addEventListener('install',   function(e) { self.skipWaiting(); });
self.addEventListener('activate',  function(e) { e.waitUntil(clients.claim()); });

// 7. Escuchar mensaje de actualización desde index.html
self.addEventListener('message', function(event) {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
