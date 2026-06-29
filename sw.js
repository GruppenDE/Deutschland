// ═══════════════════════════════════════════════════════════════
//  sw.js  —  Service Worker PWA para Gruppen🇩🇪
//  Estrategia: Cache-First para assets estáticos +
//              Network-First para HTML/API de Firestore
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME    = "gruppen-v1";          // 🔁 Cambia el número al actualizar
const CACHE_OFFLINE = "gruppen-offline-v1";

// Recursos que se guardan en caché al instalar el SW
const ASSETS_PRECACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  // Fuentes (opcionales si quieres soporte offline total)
  "https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Inter:wght@400;500;600&display=swap"
];

// ── INSTALL: pre-cachear assets esenciales ──────────────────────
self.addEventListener("install", event => {
  console.log("[SW] Instalando…");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_PRECACHE);
    }).then(() => self.skipWaiting())   // activa el SW inmediatamente
  );
});

// ── ACTIVATE: limpiar cachés antiguas ───────────────────────────
self.addEventListener("activate", event => {
  console.log("[SW] Activado");
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CACHE_OFFLINE)
          .map(k => {
            console.log("[SW] Borrando caché antigua:", k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())  // toma control de todas las pestañas
  );
});

// ── FETCH: estrategia según tipo de recurso ─────────────────────
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // ❌ Ignorar peticiones que no son GET o son de extensiones de Chrome
  if (request.method !== "GET") return;
  if (url.protocol === "chrome-extension:") return;

  // ❌ Ignorar peticiones a Firebase / APIs externas (siempre red)
  if (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebase.googleapis.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("fcm.googleapis.com") ||
    url.hostname.includes("allorigins.win")
  ) {
    return; // dejar pasar sin interceptar
  }

  // ✅ HTML principal → Network-First (siempre contenido fresco)
  if (request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // ✅ Assets estáticos (JS, CSS, imágenes, fuentes) → Cache-First
  event.respondWith(cacheFirst(request));
});

// ── Estrategia: Network-First ────────────────────────────────────
async function networkFirst(request) {
  try {
    const networkRes = await fetch(request);
    if (networkRes && networkRes.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch {
    // Sin red → devolver desde caché
    const cached = await caches.match(request);
    if (cached) return cached;
    // Último recurso: página offline
    return caches.match("/index.html");
  }
}

// ── Estrategia: Cache-First ──────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkRes = await fetch(request);
    if (networkRes && networkRes.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch {
    // Si es imagen y no hay red, devolver placeholder transparente
    if (request.destination === "image") {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
        { headers: { "Content-Type": "image/svg+xml" } }
      );
    }
    return new Response("Sin conexión", { status: 503 });
  }
}

// ── Mensaje desde la app: forzar actualización ───────────────────
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
