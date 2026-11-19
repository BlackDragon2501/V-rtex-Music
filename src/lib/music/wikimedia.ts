import { cached, fetchJson } from "./cache";
import { durationClose, FOREIGN_SCRIPT, titleMatch } from "./match";
import type { Track } from "./types";

// ============ Cliente Wikimedia Commons (audio 100% legal y COMPLETO) ============
// Commons aloja grabaciones de música libre (dominio público y Creative
// Commons): archivos OGG/MP3/FLAC completos servidos desde upload.wikimedia.org,
// sin API key ni pagos. El navegador los reproduce directamente (sin proxy).
//
// API: action=query + generator=search (namespace 6 = File:) + prop=imageinfo.

const API = "https://commons.wikimedia.org/w/api.php";
// La política de Wikimedia exige un User-Agent con información de contacto;
// sin ella la API responde 403 a las peticiones desde Node.
const UA = "VortexMusicApp/1.0 (reproductor web de música libre; contacto: vortexmusic.soporte.app@gmail.com)";

const PLAYABLE_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "application/ogg",
  "audio/x-flac",
  "audio/flac",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
]);

interface CommonsImageInfo {
  url?: string;
  mime?: string;
  size?: number;
  duration?: number; // segundos (solo archivos de audio/vídeo)
  user?: string; // usuario que subió el archivo
}

interface CommonsPage {
  pageid?: number;
  title?: string;
  imageinfo?: CommonsImageInfo[];
}

// Limpiar el nombre de archivo ("File:Astrum - Feeling It.ogg" → "Astrum - Feeling It").
function cleanTitle(title: string): string {
  return title.replace(/^File:/, "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/_/g, " ").trim();
}

// Grabaciones de pronunciación (p. ej. "LL-Q1860 (eng)-…", "Nl-reggaeton.ogg"):
// audios de diccionario, no canciones. Se descartan por título y por duración.
function looksLikePronunciation(title: string): boolean {
  return /^(LL-|[A-Z][a-z]{1,3}-)/.test(title);
}

function toTrack(page: CommonsPage): Track | null {
  const info = page.imageinfo?.[0];
  if (!page.pageid || !info?.url || !info.mime || !PLAYABLE_MIME.has(info.mime)) return null;
  const secs = Math.round(info.duration ?? 0);
  // Solo canciones de verdad: descartar locuciones/efectos (<60 s) y piezas larguísimas.
  if (secs < 60 || secs > 1800) return null;
  const title = cleanTitle(page.title ?? "");
  if (!title || looksLikePronunciation(title)) return null;
  // "Astrum - Feeling It" → artista "Astrum" si el patrón "Artista - Título" encaja.
  let artist = info.user ?? "Wikimedia Commons";
  const dash = title.split(" - ");
  if (dash.length >= 2 && dash[0].length >= 2 && dash[0].length <= 40) {
    artist = dash[0].trim();
  }
  return {
    id: `wm-${page.pageid}`,
    source: "wikimedia",
    title,
    artist,
    artwork: null,
    duration: secs,
    streamUrl: info.url,
    preview: false, // archivo COMPLETO de dominio público / Creative Commons
  };
}

export async function wikimediaSearch(queryStr: string, limit = 15, offset = 0): Promise<Track[]> {
  const q = queryStr.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${q} filetype:audio`,
    gsrnamespace: "6",
    gsrlimit: String(Math.min(Math.max(limit, 1), 30)),
    prop: "imageinfo",
    iiprop: "url|mime|size|user",
    format: "json",
  });
  // offset > 0: página avanzada (gsroffset) para la rotación de radios.
  if (offset > 0) params.set("gsroffset", String(offset));
  const url = `${API}?${params.toString()}`;
  try {
    const data = await cached<{ query?: { pages?: Record<string, CommonsPage> } }>(
      `wm:q:${q.toLowerCase()}:${limit}:${offset}`,
      30 * 60_000,
      () => fetchJson(url, 12000, UA)
    );
    const pages = Object.values(data.query?.pages ?? {});
    const tracks = pages.map(toTrack).filter((t): t is Track => t !== null);
    // Sin duplicados por título+artista, y sin títulos en alfabetos ajenos.
    const seen = new Set<string>();
    return tracks.filter((t) => {
      if (FOREIGN_SCRIPT.test(t.title)) return false;
      const k = `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  } catch {
    return [];
  }
}

// Resolución de versión completa por título en Commons (usada por el reproductor).
export async function wikimediaResolve(
  title: string,
  artist: string,
  catalogDuration: number
): Promise<Track | null> {
  if (!title.trim()) return null;
  try {
    const results = await wikimediaSearch(title, 20);
    const hit = results.find(
      (t) =>
        titleMatch(t.title, title) &&
        (catalogDuration > 0 ? durationClose(t.duration, catalogDuration) : t.duration > 60)
    );
    return hit ?? null;
  } catch {
    return null;
  }
}

// ===== Consultas dedicadas por idioma (R4 · ruso, C1 · chino tradicional) =====
// Cada consulta fue VERIFICADA contra la API de Commons devolviendo grabaciones
// completas (60+ s) de dominio público / Creative Commons:
//  · ru: "Russian folk song" (Chaliapin, Plevitskaya), "Russian romance"
//    (romances de 1903), "Soviet song" (Katyusha, Marcha de los entusiastas)
//    y "Tchaikovsky" (Marche Slave, Romeo y Julieta, Sinfonía n.º 4 y 5).
//  · cn: "guqin" (Yangguan Sandie, Zuiyu Changwan), "erhu music"
//    (二泉映月, 雨打芭蕉) y "Chinese folk song" (conjunto vocal e instrumental).
// Rotan por hora para que la radio nunca se repita igual.
const LANG_QUERIES: Record<"ru" | "cn", string[]> = {
  // ru ampliada (verificada 2026): las tres nuevas aportan Plevitskaya,
  // Chaliapin, el coro del himno ruso y el Coro Grigorovitch (dominio público).
  ru: [
    "Russian folk song",
    "Russian romance",
    "Soviet song",
    "Tchaikovsky",
    "Russian traditional song",
    "Russian choir",
    "Russian folk dance",
  ],
  // cn: las candidatas extra (guzheng, pipa, dizi…) arrastran grabaciones que
  // no son chinas en Commons; se mantienen SOLO las tres verificadas.
  cn: ["guqin", "erhu music", "Chinese folk song"],
};

// offset: página avanzada (múltiplo de 12) para la rotación de las radios
// rusas/chinas y de "Rincón del mundo"; el paso 0 mantiene las consultas
// verificadas originales y rotatedLoad vuelve a él si una página falla.
export async function wikimediaLanguage(kind: "ru" | "cn", limit = 10, offset = 0): Promise<Track[]> {
  const list = LANG_QUERIES[kind];
  // Se consultan TODAS las verificaciones del idioma: Commons no tiene cuota
  // ajustada y así cada radio maximiza el contenido completo disponible.
  // 12 por consulta (página gsrlimit=12): el offset debe ser múltiplo de 12.
  const PER_QUERY = 12;
  const halves = await Promise.allSettled(list.map((q) => wikimediaSearch(q, PER_QUERY, offset)));
  const merged: Track[] = [];
  for (const h of halves) if (h.status === "fulfilled") merged.push(...h.value);
  // Algunas búsquedas (p. ej. "Soviet song") arrastran grabaciones en alfabetos
  // ajenos (devanagari, árabe…): no pueden ser música rusa ni china, se descartan
  // (FOREIGN_SCRIPT ya se aplica dentro de wikimediaSearch).
  const seen = new Set<string>();
  return merged.filter((t) => {
    const k = `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, limit);
}
