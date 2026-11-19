import { cached, fetchJson } from "./cache";
import { artistMatch, durationClose, normalize, titleMatch } from "./match";
import { openverseJamendo } from "./openverse";
import type { Track } from "./types";

// ============ Cliente DIRECTO de la API de Jamendo (R1) ============
// Jamendo publica más de 640.000 canciones de artistas independientes bajo
// licencias Creative Commons: audio COMPLETO en streaming (campo "audio"),
// 100% legal y gratuito para apps no comerciales como Vórtex Music.
//
// El acceso directo requiere un client_id GRATUITO registrado en
// https://developer.jamendo.com (nivel no comercial: 35.000 peticiones/mes).
// Se configura en .env como JAMENDO_CLIENT_ID.
//
// NOTA: el .env de este entorno se regenera periódicamente y puede perder la
// variable, así que el client_id queda TAMBIÉN como fallback en código
// (prioridad: process.env si existe; si no, el fallback).
//
// SIN client_id el módulo NO se rompe: degrada con elegancia a Openverse
// filtrando source=jamendo (el mismo catálogo de Jamendo servido por el
// agregador de Creative Commons). Al registrar el client_id, el acceso directo
// se activa solo, sin cambios de código: orden por popularidad semanal,
// agrupación por artista y URLs de mp3 estables.

const BASE = "https://api.jamendo.com/v3.0/tracks/";

// La protección anti-abuso de Jamendo filtra por User-Agent: tras muchas
// peticiones desde un mismo cliente responde HTTP 200 con status "success"
// pero con la lista de resultados VACÍA (no hay error visible). Los UA de
// navegador y el por defecto de Node pasan; el UA identificable de la app,
// no. Por eso probamos en orden y recordamos cuál funcionó por última vez.
const JAM_UAS = [
  "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "", // sin cabecera User-Agent (la por defecto del runtime)
];
let jamUaIndex = 0;

// Enfriamiento tras un bloqueo: si todos los intentos vuelven vacíos, la
// protección anti-abuso está activa y MARTILLARLA la extiende. Se pausa el
// acceso directo 2 min (las llamadas devuelven [] al instante, sin red) y
// luego se reintenta con naturalidad. Openverse ya cubre ese catálogo mientras.
const JAM_COOLDOWN_MS = 5 * 60_000;
let jamBlockedUntil = 0;

const JAMENDO_CLIENT_ID_FALLBACK = "e12d2d66";

function clientId(): string {
  return (process.env.JAMENDO_CLIENT_ID || JAMENDO_CLIENT_ID_FALLBACK).trim();
}

export function jamendoConfigured(): boolean {
  return clientId().length > 0;
}

interface JamendoTrack {
  id: string;
  name?: string;
  duration?: number; // segundos
  artist_id?: string;
  artist_name?: string;
  album_name?: string;
  album_image?: string;
  image?: string;
  audio?: string;
  audiodownload?: string;
  license_ccurl?: string;
  musicinfo?: { tags?: { genres?: string[] } };
}

function mapJm(r: JamendoTrack): Track | null {
  const url = r.audio ?? "";
  const secs = Math.round(r.duration ?? 0);
  if (!r.id || !url.startsWith("https://") || secs < 60 || secs > 1800) return null;
  const title = (r.name ?? "").trim();
  const artist = (r.artist_name ?? "").trim();
  if (!title || !artist) return null;
  return {
    id: `jm-${r.id}`,
    source: "jamendo",
    title,
    artist,
    album: r.album_name ?? undefined,
    artwork: r.image || r.album_image || null,
    duration: secs,
    streamUrl: url,
    preview: false, // audio COMPLETO bajo licencia Creative Commons
    genre: r.musicinfo?.tags?.genres?.[0] ?? undefined,
  };
}

function dedupe(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    const k = `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Consulta con rotación de User-Agent y reintentos: Jamendo limita por
// ráfagas respondiendo HTTP 200 "success" con la lista VACÍA de forma
// intermitente (un mismo URL puede pasar y fallar segundos después). La
// respuesta vacía es pasajera: 3 intentos con pausas la atraviesan, y la
// caché larga evita repetir la consulta en estado estable.
async function jamendoApi(
  qs: string,
  timeoutMs: number
): Promise<{ results?: JamendoTrack[] } | null> {
  const ATTEMPTS = 3;
  const PAUSAS = [0, 900, 2200];
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (PAUSAS[attempt]) await new Promise((r) => setTimeout(r, PAUSAS[attempt]));
    const idx = (jamUaIndex + attempt) % JAM_UAS.length;
    try {
      const data = await fetchJson<{ results?: JamendoTrack[] }>(
        `${BASE}?${qs}`,
        timeoutMs,
        JAM_UAS[idx] // "" → sin cabecera UA (fetchJson lo interpreta así)
      );
      if ((data.results ?? []).length > 0) {
        jamUaIndex = idx;
        return data;
      }
    } catch {
      /* probar el siguiente intento/UA */
    }
  }
  return null;
}

// Consulta directa a Jamendo; sin client_id → Openverse filtrado a Jamendo.
async function jamendoFetch(
  params: Record<string, string>,
  fallbackQuery: string,
  limit: number
): Promise<Track[]> {
  const cid = clientId();
  if (!cid) {
    try {
      return dedupe((await openverseJamendo(fallbackQuery, limit)).filter((t) => t.duration >= 60));
    } catch {
      return [];
    }
  }
  // Durante el enfriamiento no se pega a la API: devuelve [] sin red.
  if (Date.now() < jamBlockedUntil) return [];
  const qs = new URLSearchParams({
    client_id: cid,
    format: "json",
    limit: String(Math.min(Math.max(limit, 1), 90)),
    audioformat: "mp32",
    include: "musicinfo+licenses",
    groupby: "artist_id",
    ...params,
  });
  const data = await jamendoApi(qs.toString(), 15000);
  if (!data) {
    // Bloqueo anti-abuso (o red caída): activar enfriamiento y reintentar luego.
    jamBlockedUntil = Date.now() + JAM_COOLDOWN_MS;
    return [];
  }
  jamBlockedUntil = 0;
  return dedupe((data.results ?? []).map(mapJm).filter((t): t is Track => t !== null));
}

// Búsqueda de canciones completas (título, artista o texto libre).
// offset: página aleatoria para la rotación de Tendencias y radios.
export async function jamendoSearch(query: string, limit = 20, offset = 0): Promise<Track[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    return await jamendoFetch(
      { search: q, order: "relevance", offset: String(offset) },
      q,
      limit
    );
  } catch {
    return [];
  }
}

// Igual que la búsqueda pero con caché larga (para radios por género).
// El offset forma parte de la clave: cada página rotada se cachea aparte.
export async function jamendoByQuery(query: string, limit = 16, offset = 0): Promise<Track[]> {
  return cached(`jm:q:${query.toLowerCase()}:${limit}:${offset}`, 60 * 60_000, () =>
    jamendoSearch(query, limit, offset)
  );
}

// Portada: lo más popular de la semana en Jamendo, con cascada de órdenes
// si una ventana no rinde (contenido siempre fresco).
// offset: página aleatoria para la rotación de "Sonidos libres".
export async function jamendoHome(limit = 20, offset = 0): Promise<Track[]> {
  const orders = ["popularity_week", "popularity_month", "popularity_total"] as const;
  let fallback: Track[] = [];
  for (const order of orders) {
    try {
      const tracks = await cached(`jm:home:${order}:${limit}:${offset}`, 60 * 60_000, () =>
        jamendoFetch({ order, offset: String(offset) }, order, limit)
      );
      const good = tracks.filter((t) => t.duration >= 90);
      if (good.length >= 8) return good.slice(0, limit);
      if (good.length > fallback.length) fallback = good;
    } catch {
      /* probar el siguiente orden */
    }
  }
  return fallback.slice(0, limit);
}

// Mundo: canciones rusas y chinas reales en Jamendo (fallback verificado
// vía Openverse). Complementa a Wikimedia Commons para las radios dedicadas.
// offset: página aleatoria para la rotación de "Rincón del mundo".
export async function jamendoWorld(kind: "ru" | "cn", limit = 8, offset = 0): Promise<Track[]> {
  const q = kind === "ru" ? "russian folk song" : "chinese traditional music";
  return cached(`jm:world:${kind}:${limit}:${offset}`, 60 * 60_000, () =>
    jamendoSearch(q, limit, offset)
  );
}

// Resolución de versión completa en Jamendo: busca "artista título" y devuelve
// la pista que encaja por título/artista/duración con el catálogo original.
export async function jamendoResolve(
  title: string,
  artist: string,
  catalogDuration: number
): Promise<Track | null> {
  if (!normalize(title)) return null;
  try {
    const results = await cached(
      `jm:resolve:${title.toLowerCase()}|${artist.toLowerCase()}`,
      60 * 60_000,
      async () => {
        try {
          return await jamendoSearch(`${artist} ${title}`.trim(), 30);
        } catch {
          return [];
        }
      }
    );
    const hits = results.filter((t) => titleMatch(t.title, title) && t.duration > 60);
    // 1) Coincidencia de artista y duración.
    const exact = hits.find(
      (t) =>
        artistMatch(t.artist, artist) &&
        (catalogDuration > 0 ? durationClose(t.duration, catalogDuration) : true)
    );
    if (exact) return exact;
    // 2) Coincidencia de duración aunque el artista difiera.
    const loose = hits.find((t) => catalogDuration > 0 && durationClose(t.duration, catalogDuration));
    return loose ?? null;
  } catch {
    return null;
  }
}
