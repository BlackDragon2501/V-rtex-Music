import { cached, fetchJson, getCache, setCache } from "./cache";
import { durationClose, normalize, titleMatch } from "./match";
import { randomStep } from "./rotation";
import type { Track } from "./types";

// ============ Cliente Openverse API (audio 100% libre y COMPLETO, sin API key) ============
// Openverse agrega catálogos de audio de Creative Commons. Su catálogo actual
// (verificado 2026) contiene DOS fuentes de música:
//   · Jamendo      → artistas independientes, canciones COMPLETAS (mp3 streaming)
//   · Wikimedia Commons → grabaciones de dominio público COMPLETAS
// (ccMixter y FMA fueron retirados del agregador; la app los consulta directo).
// Las URLs devueltas ("url") son archivos de audio directos a longitud completa.
//
// Límites anónimos: 20 peticiones/min y 200/día → TODAS las llamadas pasan por
// la caché del servidor con TTL largo y se consultan poco a menudo.

const UA = "VortexMusic/1.0 (web player; openverse)";

// Dominios de la API: el oficial (openverse.org) y el clásico (engineering),
// que sirven LA MISMA API. Si el entorno no alcanza el oficial (p. ej. bloqueo
// anti-abuso contra IPs de datacenter, como pasa con archive.org), se recuerda
// el alternativo y todas las llamadas pasan a usarlo sin reintento extra.
const HOSTS = ["https://api.openverse.org", "https://api.openverse.engineering"];
let hostIdx = 0;

async function fetchAudio<T>(path: string, timeoutMs: number): Promise<T> {
  for (let i = 0; i < HOSTS.length; i++) {
    try {
      return await fetchJson<T>(`${HOSTS[hostIdx]}/v1/audio${path}`, timeoutMs, UA);
    } catch (e) {
      // Solo cambia de dominio ante fallo de RED (no ante HTTP 429/5xx: esos
      // son límites de cuota y el otro dominio los comparte igual).
      const redDown = e instanceof Error && !/^HTTP \d+/.test(e.message);
      if (redDown && hostIdx < HOSTS.length - 1) {
        hostIdx += 1;
        continue;
      }
      throw e;
    }
  }
  throw new Error("openverse: sin dominios disponibles");
}

interface OpenverseAudio {
  id: string;
  title?: string;
  creator?: string;
  url?: string;
  duration?: number; // milisegundos
  thumbnail?: string | null;
  source?: string; // "jamendo" | "ccmixter" | "fma" | "wikimedia_audio" | ...
  genres?: string[];
}

function ovTrack(r: OpenverseAudio): Track | null {
  const url = r.url ?? "";
  if (!r.id || !url.startsWith("https://")) return null;
  // Descartar archivos que Openverse indexa pero que no son audio reproducible
  // (p. ej. "Katyusha.mid" de Wikimedia: MIDI, partituras y documentos).
  const path = url.split("?")[0].toLowerCase();
  if (!/\.(mp3|ogg|oga|opus|flac|wav|m4a|webm)$/.test(path)) return null;
  const secs = Math.round((r.duration ?? 0) / 1000);
  // Solo canciones de verdad: descartar clips/efectos cortos (<60 s) y locuciones larguísimas.
  if (secs < 60 || secs > 1800) return null;
  // freesound son efectos; no es música.
  if (r.source === "freesound") return null;
  return {
    id: `ov-${r.id}`,
    source: "openverse",
    origin: r.source ?? undefined,
    title: (r.title ?? "Pista libre").trim(),
    artist: (r.creator ?? "Artista libre").trim(),
    artwork: r.thumbnail ?? null,
    duration: secs,
    streamUrl: url,
    preview: false, // audio a longitud completa
  };
}

// Caché negativa: Openverse anónimo permite solo 20 peticiones/min y 200/día.
// Si una consulta acaba de fallar o volver vacía (cuota agotada, pico de red),
// NO se repite de inmediato: se recuerda el fallo unos minutos y se responde
// [] sin gastar cuota. La siguiente generación del pool la reintenta sola.
async function negGuard(base: string, loader: () => Promise<Track[]>): Promise<Track[]> {
  const negUntil = getCache<number>(`ov:neg:${base}`);
  if (typeof negUntil === "number" && Date.now() < negUntil) return [];
  try {
    const out = await loader();
    if (out.length === 0) setCache(`ov:neg:${base}`, Date.now() + 5 * 60_000);
    return out;
  } catch {
    setCache(`ov:neg:${base}`, Date.now() + 3 * 60_000);
    return [];
  }
}

export async function openverseSearch(
  query: string,
  limit = 20,
  source?: "jamendo" | "wikimedia_audio",
  page = 1
): Promise<Track[]> {
  const q = query.trim();
  if (!q) return [];
  // Sin fuente explícita se restringe a las DOS fuentes de música reales del
  // catálogo (jamendo + wikimedia_audio): sin esto Openverse antepone efectos
  // de freesound (golpes, ruidos de 1-20 s) que ovTrack descartaría uno a uno,
  // dejando las listas vacías (verificado con consultas de género).
  const src = `&source=${source ?? "jamendo,wikimedia_audio"}`;
  // page > 1: página aleatoria para la rotación de Tendencias y radios.
  const path = `/?q=${encodeURIComponent(q)}${src}&page_size=${Math.min(
    Math.max(limit, 1),
    20
  )}&page=${Math.max(1, page)}`;
  const data = await fetchAudio<{ results?: OpenverseAudio[] }>(path, 12000);
  const tracks = (data.results ?? []).map(ovTrack).filter((t): t is Track => t !== null);
  // Sin duplicados por título+artista (cero ruido en las listas).
  const seen = new Set<string>();
  return tracks.filter((t) => {
    const k = `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Solo Jamendo vía Openverse: fallback del cliente directo de Jamendo cuando
// aún no se configuró el client_id gratuito (mismo catálogo, vía agregador).
export async function openverseJamendo(query: string, limit = 20, page = 1): Promise<Track[]> {
  return negGuard(`jam:${query.toLowerCase()}:${limit}:${page}`, () =>
    cached(`ov:jam:${query.toLowerCase()}:${limit}:${page}`, 120 * 60_000, () =>
      openverseSearch(query, limit, "jamendo", page)
    )
  );
}

// Selección rotativa para la portada: consultas verificadas que devuelven
// canciones reales a longitud completa en Openverse/Jamendo. Se rota cada hora
// y se prueban candidatas en cascada si una no rinde (poco gasto de cuota).
const HOME_QUERIES = [
  "rock",
  "acoustic",
  "jazz",
  "hip hop",
  "trance",
  "reggaeton",
  "house music",
  "folk",
  "ambient",
  "electronic",
  "indie rock",
  "lofi",
];

async function openverseQueryCached(query: string, page = 1): Promise<Track[]> {
  return negGuard(`q:${query.toLowerCase()}:${page}`, () =>
    cached(`ov:q:${query.toLowerCase()}:${page}`, 120 * 60_000, () =>
      openverseSearch(query, 20, undefined, page)
    )
  );
}

// Portada "Sonidos libres": en vez de quedarse con la primera consulta que
// rinde, UNIR todas las candidatas del tramo horario (pool grande para que la
// rotación por sesión reparta canciones distintas en cada visita). Cada
// consulta usa además una página aleatoria 1-3 para variar entre generaciones.
export async function openverseHome(limit = 20): Promise<Track[]> {
  const hour = Math.floor(Date.now() / 3_600_000);
  const candidates = [
    HOME_QUERIES[hour % HOME_QUERIES.length],
    HOME_QUERIES[(hour + 1) % HOME_QUERIES.length],
    HOME_QUERIES[(hour + 5) % HOME_QUERIES.length],
  ];
  const merged: Track[] = [];
  const seen = new Set<string>();
  for (const q of candidates) {
    try {
      const page = 1 + randomStep(2); // página aleatoria 1-2: variedad cuidando la cuota
      const tracks = (await openverseQueryCached(q, page)).filter((t) => t.duration >= 90);
      for (const t of tracks) {
        const k = `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;
        if (seen.has(k)) continue;
        seen.add(k);
        merged.push(t);
      }
    } catch {
      /* probar la siguiente consulta */
    }
  }
  return merged.slice(0, limit);
}

// Búsqueda para géneros (con caché largo: el límite diario es limitado).
// page: página aleatoria para la rotación de radios.
export async function openverseByQuery(query: string, limit = 16, page = 1): Promise<Track[]> {
  return negGuard(`genre:${query.toLowerCase()}:${limit}:${page}`, () =>
    cached(`ov:genre:${query.toLowerCase()}:${limit}:${page}`, 120 * 60_000, () =>
      openverseSearch(query, limit, undefined, page)
    )
  );
}

// Resolución de versión completa: busca la misma canción (título + artista)
// en los catálogos libres y devuelve la pista cuya duración encaja con la del
// catálogo original. Se usa para sustituir cualquier pista sin audio completo.
// Openverse no combina bien artista+título: si el combo no da resultados,
// se busca por título solo y la duración + título desambigan la coincidencia.
export async function openverseResolve(
  title: string,
  artist: string,
  catalogDuration: number
): Promise<Track | null> {
  if (!normalize(title)) return null;
  try {
    let results = await cached(
      `ov:resolve:${title.toLowerCase()}|${artist.toLowerCase()}`,
      60 * 60_000,
      async () => {
        try {
          return await openverseSearch(`${artist} ${title}`.trim(), 20);
        } catch {
          return [];
        }
      }
    );
    if (results.length === 0) {
      results = await cached(
        `ov:resolve-t:${normalize(title)}`,
        60 * 60_000,
        async () => {
          try {
            return await openverseSearch(title, 20);
          } catch {
            return [];
          }
        }
      );
    }
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
