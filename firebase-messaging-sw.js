// ═══════════════════════════════════════════════════════════════
//  firebase-messaging-sw.js
//  Service Worker para notificaciones push reales (FCM)
//
//  ⚠️  IMPORTANTE: este archivo debe estar en la RAÍZ de tu sitio,
//      en el mismo directorio que index.html (no en subcarpetas).
//      En GitHub Pages: raíz del repositorio.
// ═══════════════════════════════════════════════════════════════

importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js");

// ── Misma config que en index.html ──
firebase.initializeApp({
  apiKey:            "AIzaSyA3GpW1N7i9YNdw7KtZXx5VFgWyWoyoBYM",
  authDomain:        "gruppende-94f00.firebaseapp.com",
  projectId:         "gruppende-94f00",
  storageBucket:     "gruppende-94f00.firebasestorage.app",
  messagingSenderId: "902209990512",
  appId:             "1:902209990512:web:eee7151f40ac41c70ba9b5"
});

const messaging = firebase.messaging();

// ── Notificaciones en BACKGROUND (app cerrada o en otra pestaña) ──
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || "Gruppen🇩🇪 — Neue Gruppe! 🎉", {
    body:  body  || payload.data?.mensaje || "Schau dir die neue Gruppe an!",
    icon:  icon  || "/icon-192.png",
    badge: "/icon-192.png",
    tag:   "gruppen-push",          // reemplaza la anterior para no apilar
    renotify: true,
    data:  { url: self.location.origin }
  });
});

// ── Escuchar Firestore directamente desde el SW ──
// Cuando el admin guarda en /notificaciones/global, el SW lo detecta
// y muestra la notificación del sistema a TODOS los suscriptores.
const db = firebase.firestore();
let _lastNotifId = null;

db.collection("notificaciones").doc("global").onSnapshot(snap => {
  if (!snap.exists) return;
  const data = snap.data();
  if (!data || !data.id) return;
  if (data.id === _lastNotifId) return;   // ya procesada
  _lastNotifId = data.id;

  self.registration.showNotification(data.titulo || "Gruppen🇩🇪 — Neue Gruppe! 🎉", {
    body:     data.mensaje || "Schau dir die neue Gruppe an!",
    icon:     "/icon-192.png",
    badge:    "/icon-192.png",
    tag:      "gruppen-push",
    renotify: true,
    vibrate:  [200, 100, 200],
    data:     { url: self.location.origin }
  });
});

// ── Al pulsar la notificación: abrir la web ──
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || self.location.origin;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
