/**
 * ============================================================================
 *  VISTA PREVIA DINÁMICA POR GRUPO — 100% GRATIS (Cloudflare Workers)
 * ============================================================================
 *
 *  Reemplaza la necesidad de Firebase Functions (plan Blaze de pago).
 *  Se ejecuta en el plan GRATUITO de Cloudflare Workers (100,000
 *  peticiones/día, sin tarjeta de crédito).
 *
 *  Qué hace:
 *   - Si quien pide la página es un BOT de WhatsApp/Telegram/Facebook/etc.
 *     Y la URL trae "?grupo=slug", responde un HTML mínimo con las
 *     etiquetas Open Graph (foto, título, descripción) de ESE grupo,
 *     leyendo los datos directamente de Firestore (API pública REST,
 *     sin necesidad de credenciales).
 *   - En cualquier otro caso (una persona real, o sin "?grupo="), deja
 *     pasar la petición sin tocarla hacia tu Firebase Hosting normal.
 *
 *  Requisito importante:
 *   La colección "grupos_extra" de Firestore debe permitir LECTURA pública
 *   (allow read: if true;), que ya es lo que necesita tu app hoy para que
 *   cualquier visitante vea los grupos sin iniciar sesión. Si tu regla de
 *   Firestore exige autenticación para leer, este Worker no podrá leer los
 *   datos y simplemente dejará pasar la petición normal (no rompe nada,
 *   solo no se genera la vista previa personalizada).
 * ============================================================================
 */

const PROJECT_ID = "gruppende-94f00"; // tomado de tu firebaseConfig

const BOT_UA_REGEX =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|LinkedInBot|Slackbot|Discordbot|SkypeUriPreview|Pinterest|redditbot|vkShare|Applebot/i;

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const ua = request.headers.get("User-Agent") || "";
      const esBot = BOT_UA_REGEX.test(ua);
      const slug = url.searchParams.get("grupo");

      if (esBot && slug) {
        const grupo = await buscarGrupoPorSlug(slug);
        if (grupo) {
          return new Response(renderHtmlBot(grupo, slug, url.origin), {
            headers: {
              "content-type": "text/html; charset=UTF-8",
              "cache-control": "public, max-age=300",
            },
          });
        }
      }
    } catch (e) {
      // Si algo falla (Firestore no responde, etc.), no rompas la página:
      // sigue de largo y deja pasar la petición normal.
      console.log("Worker: fallback por error", e && e.message);
    }

    // Todo lo demás: pasar la petición tal cual hacia el origen real (Firebase Hosting)
    return fetch(request);
  },
};

// Debe coincidir EXACTAMENTE con generarSlug() del index.html
function generarSlug(nombre) {
  return (nombre || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\uFE0F/g, "")
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function parseFirestoreDoc(doc) {
  const fields = doc.fields || {};
  const out = {};
  for (const k in fields) {
    const v = fields[k];
    out[k] =
      v.stringValue ??
      v.integerValue ??
      v.doubleValue ??
      v.booleanValue ??
      "";
  }
  return out;
}

async function buscarGrupoPorSlug(slug) {
  let pageToken = "";
  // Recorre hasta ~1500 grupos (300 x 5 páginas). Ajusta si tu directorio crece más.
  for (let i = 0; i < 5; i++) {
    const u =
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/grupos_extra?pageSize=300` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const res = await fetch(u);
    if (!res.ok) break;
    const data = await res.json();
    const docs = data.documents || [];
    for (const doc of docs) {
      const g = parseFirestoreDoc(doc);
      if (g.nombre && generarSlug(g.nombre) === slug) return g;
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return null;
}

function escapeHtml(str) {
  return String(str || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
}

function renderHtmlBot(grupo, slug, origin) {
  const url = `${origin}/?grupo=${encodeURIComponent(slug)}`;
  const titulo = escapeHtml(grupo.nombre);
  const descripcion = escapeHtml(
    grupo.descripcion ||
      `${grupo.plataforma || ""} Gruppe auf Gruppen🇩🇪 — Finde deine Community.`
  );
  const imagen = grupo.img || `${origin}/icon-192x192.png`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>${titulo} · Gruppen🇩🇪</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="Gruppen🇩🇪">
<meta property="og:title" content="${titulo}">
<meta property="og:description" content="${descripcion}">
<meta property="og:image" content="${escapeHtml(imagen)}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${titulo}">
<meta name="twitter:description" content="${descripcion}">
<meta name="twitter:image" content="${escapeHtml(imagen)}">
<meta http-equiv="refresh" content="0; url=${url}">
</head>
<body>
<a href="${url}">${titulo}</a>
</body>
</html>`;
}
