/* ═══════════════════════════════════════════════════════════════
   sw.js — Service Worker para Gruppen🇩🇪
   Estrategia: Cache-First para assets, Network-First para HTML/API
   ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = "gruppen-de-v2";
const CACHE_STATIC = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-72x72.png",
  "./icon-96x96.png",
  "./icon-128x128.png",
  "./icon-144x144.png",
  "./icon-152x152.png",
  "./icon-192x192.png",
  "./icon-384x384.png",
  "./icon-512x512.png"
];

/* ── INSTALL: precachear assets estáticos ── */
self.addEventListener("install", event => {
  console.log("[SW] Instalando v2…");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CACHE_STATIC).catch(err => {
        console.warn("[SW] Error precacheando:", err);
      });
    })
  );
  self.skipWaiting(); // Activar inmediatamente sin esperar
});

/* ── ACTIVATE: borrar caches antiguos ── */
self.addEventListener("activate", event => {
  console.log("[SW] Activando…");
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log("[SW] Borrando cache antiguo:", key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: estrategia mixta ── */
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Ignorar requests no-GET y externos (Firebase, Google Fonts, etc.)
  if (event.request.method !== "GET") return;
  if (!url.origin.includes(self.location.origin) &&
      !url.hostname.includes("github.io")) return;

  // Para HTML → Network-First (siempre contenido fresco)
  if (event.request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Para assets (iconos, imágenes, etc.) → Cache-First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === "error") {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});

/* ── MESSAGE: forzar actualización desde el cliente ── */
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
