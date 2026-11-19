import { cached, fetchJson } from "./cache";
import { artistMatch, durationClose, titleMatch } from "./match";
import type { Artist, Track } from "./types";

// ============ Cliente Audius API (música 100% libre y completa, sin API key) ============
// Audius es una red de streaming descentralizada de artistas independientes.
// Las pistas se reproducen COMPLETAS vía /v1/tracks/{id}/stream (endpoint estable
// que redirige al nodo de contenido con URL firmada en cada reproducción).

const APP_NAME = "VortexMusic";
const ROOT = "https://api.audius.co";

const HOST_KEY = "audius:host";
const HOST_TTL = 10 * 60_000;

async function getHost(): Promise<string> {
  return cached<string>(HOST_KEY, HOST_TTL, async () => {
    const data = await fetchJson<{ data: string[] }>(ROOT, 12000);
    const hosts = (data.data ?? []).filter((h) => h.startsWith("https://"));
    if (hosts.length === 0) throw new Error("Audius: sin hosts disponibles");
    return hosts[Math.floor(Math.random() * hosts.length)].replace(/\/$/, "");
  });
}

async function audiusGet<T>(path: string, timeoutMs = 15000): Promise<T> {
  const host = await getHost();
  return fetchJson<T>(`${host}${path}${path.includes("?") ? "&" : "?"}app_name=${APP_NAME}`, timeoutMs);
}

interface AudiusArtwork {
  "150x150"?: string;
  "480x480"?: string;
  "1000x1000"?: string;
}

interface AudiusTrack {
  id: string;
  title: string;
  duration: number;
  genre?: string | null;
  mood?: string | null;
  is_streamable?: boolean;
  is_delete?: boolean;
  is_available?: boolean;
  artwork?: AudiusArtwork | null;
  user?: { id?: string; name?: string; avatar?: AudiusArtwork | null };
}

function pickArt(a?: AudiusArtwork | null): string | null {
  if (!a) return null;
  return a["1000x1000"] ?? a["480x480"] ?? a["150x150"] ?? null;
}

export function auTrack(t: AudiusTrack, host?: string): Track {
  return {
    id: `au-${t.id}`,
    source: "audius",
    title: t.title,
    artist: t.user?.name ?? "Artista Audius",
    artistId: t.user?.id ? `au-${t.user.id}` : undefined,
    artwork: pickArt(t.artwork) ?? pickArt(t.user?.avatar),
    duration: t.duration ?? 0,
    // El endpoint /stream es estable: el <audio> lo resuelve (redirect) en cada play.
    streamUrl: host
      ? `${host}/v1/tracks/${t.id}/stream?app_name=${APP_NAME}`
      : `${ROOT}/v1/tracks/${t.id}/stream?app_name=${APP_NAME}`,
    preview: false,
    genre: t.genre ?? undefined,
  };
}

function valid(t: AudiusTrack): boolean {
  return !t.is_delete && t.is_available !== false && Boolean(t.id);
}

// offset: página aleatoria para la rotación de Tendencias (0 = contenido base).
export async function audiusTrending(limit = 24, offset = 0): Promise<Track[]> {
  const data = await audiusGet<{ data: AudiusTrack[] }>(
    `/v1/tracks/trending?limit=${limit}&offset=${offset}&time=week`
  );
  return (data.data ?? []).filter(valid).map((t) => auTrack(t));
}

export async function audiusUnderground(limit = 16, offset = 0): Promise<Track[]> {
  const data = await audiusGet<{ data: AudiusTrack[] }>(
    `/v1/tracks/trending/underground?limit=${limit}&offset=${offset}`
  );
  return (data.data ?? []).filter(valid).map((t) => auTrack(t));
}

export async function audiusSearchTracks(query: string, limit = 20): Promise<Track[]> {
  const data = await audiusGet<{ data: AudiusTrack[] }>(
    `/v1/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}`
  );
  return (data.data ?? []).filter(valid).map((t) => auTrack(t));
}

// Búsqueda de ARTISTAS (usuarios de Audius) para la sección de artistas.
export async function audiusSearchUsers(query: string, limit = 10): Promise<Artist[]> {
  const data = await audiusGet<{ data: AudiusUser[] }>(
    `/v1/users/search?query=${encodeURIComponent(query)}&limit=${limit}`
  );
  return (data.data ?? [])
    .filter((u) => Boolean(u.id) && Boolean(u.name))
    .map((u) => ({
      id: `au-${u.id}`,
      name: u.name!,
      artwork: pickArt(u.avatar) ?? null,
      genre: "Audius",
    }));
}

// offset: página aleatoria para la rotación de radios (0 = tendencias del género).
export async function audiusByGenre(genre: string, limit = 20, offset = 0): Promise<Track[]> {
  const data = await audiusGet<{ data: AudiusTrack[] }>(
    `/v1/tracks/trending?genre=${encodeURIComponent(genre)}&limit=${limit}&offset=${offset}&time=week`
  );
  return (data.data ?? []).filter(valid).map((t) => auTrack(t));
}

interface AudiusUser {
  id: string;
  name?: string;
  avatar?: AudiusArtwork | null;
}

// Detalle de artista de Audius: perfil + sus canciones más reproducidas.
export async function audiusArtistDetail(
  userId: string
): Promise<{ artist: Artist; topSongs: Track[] } | null> {
  const userRes = await audiusGet<{ data: AudiusUser | null }>(`/v1/users/${encodeURIComponent(userId)}`);
  const u = userRes.data;
  if (!u || !u.id) return null;
  const tracksRes = await audiusGet<{ data: AudiusTrack[] }>(
    `/v1/users/${encodeURIComponent(userId)}/tracks?sort=plays&limit=25`
  );
  const topSongs = (tracksRes.data ?? []).filter(valid).map((t) => auTrack(t));
  return {
    artist: {
      id: `au-${userId}`,
      name: u.name ?? "Artista Audius",
      artwork: pickArt(u.avatar) ?? topSongs[0]?.artwork ?? null,
    },
    topSongs,
  };
}

// Resolución de versión COMPLETA en Audius: busca "artista título" y devuelve
// la pista cuyo título, artista y duración encajan con la del catálogo original.
// Se usa para sustituir cualquier pista sin audio a longitud completa.
export async function audiusResolve(
  title: string,
  artist: string,
  catalogDuration: number
): Promise<Track | null> {
  try {
    const results = await cached(
      `au:resolve:${title.toLowerCase()}|${artist.toLowerCase()}`,
      60 * 60_000,
      () => audiusSearchTracks(`${artist} ${title}`.trim(), 20)
    );
    const hits = results.filter((t) => titleMatch(t.title, title) && t.duration > 60);
    // 1) Coincidencia exacta de artista y duración.
    const exact = hits.find(
      (t) =>
        artistMatch(t.artist, artist) &&
        (catalogDuration > 0 ? durationClose(t.duration, catalogDuration) : true)
    );
    if (exact) return exact;
    // 2) Coincidencia de duración aunque el artista difiera (versión de otro intérprete).
    const loose = hits.find((t) => catalogDuration > 0 && durationClose(t.duration, catalogDuration));
    return loose ?? null;
  } catch {
    return null;
  }
}
