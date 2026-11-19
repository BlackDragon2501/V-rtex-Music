import { cached, fetchJsonLenient } from "./cache";
import { durationClose, titleMatch } from "./match";
import type { Artist, Track } from "./types";

// ============ Cliente ccMixter API (audio 100% legal, libre y COMPLETO) ============
// ccMixter es una comunidad de remixes y música original bajo licencias
// Creative Commons: cada subida entrega el archivo MP3 completo (sin avances),
// sin registro ni API key.
//
// API: https://ccmixter.org/api/query?f=json&…  (any=, tags=, artist=, limit=)
// El audio requiere cabecera Referer de ccmixter.org, por lo que se sirve a
// través del proxy interno /api/music/stream/cc (soporta Range para el seek).

const BASE = "https://ccmixter.org/api/query";

interface CcmixterFile {
  file_name?: string;
  download_url?: string;
  file_format_info?: {
    "media-type"?: string;
    mime_type?: string;
    ps?: string; // duración "7:37"
  };
}

interface CcmixterUpload {
  upload_id?: number;
  upload_name?: string;
  user_name?: string;
  user_real_name?: string;
  nsfw?: boolean;
  files?: CcmixterFile[];
}

// "7:37" | "1:02:33" → segundos
function parsePs(ps?: string): number {
  if (!ps) return 0;
  const parts = ps.split(":").map((n) => Number(n));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  let secs = 0;
  for (const p of parts) secs = secs * 60 + p;
  return Math.round(secs);
}

function bestFile(u: CcmixterUpload): CcmixterFile | null {
  const files = (u.files ?? []).filter(
    (f) => f.file_format_info?.["media-type"] === "audio" && f.download_url
  );
  // Preferimos MP3 (compatibilidad total con <audio>); luego cualquier audio.
  return (
    files.find((f) => f.file_format_info?.mime_type === "audio/mpeg") ?? files[0] ?? null
  );
}

function toProxyUrl(downloadUrl: string): string | null {
  try {
    const u = new URL(downloadUrl);
    if (u.hostname !== "ccmixter.org" || !u.pathname.startsWith("/content/")) return null;
    return `/api/music/stream/cc?p=${encodeURIComponent(u.pathname)}`;
  } catch {
    return null;
  }
}

function toTrack(u: CcmixterUpload): Track | null {
  if (!u.upload_id || !u.upload_name || u.nsfw) return null;
  const file = bestFile(u);
  if (!file) return null;
  const streamUrl = toProxyUrl(file.download_url!);
  if (!streamUrl) return null;
  const secs = parsePs(file.file_format_info?.ps);
  // Solo canciones de verdad: descartar clips/efectos (<60 s) y piezas larguísimas.
  if (secs < 60 || secs > 1800) return null;
  const artist = (u.user_real_name?.trim() || u.user_name || "Artista ccMixter").trim();
  return {
    id: `ccm-${u.upload_id}`,
    source: "ccmixter",
    title: u.upload_name.trim(),
    artist,
    artistId: u.user_name ? `cc-${encodeURIComponent(u.user_name)}` : undefined,
    artwork: null,
    duration: secs,
    streamUrl,
    preview: false, // archivo COMPLETO bajo licencia Creative Commons
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

async function query(params: string, ttlMs: number): Promise<Track[]> {
  const data = await cached<CcmixterUpload[]>(
    `ccm:q:${params}`,
    ttlMs,
    // fetchJsonLenient: la API duplica el JSON en una cabecera X-JSON enorme.
    () => fetchJsonLenient<CcmixterUpload[]>(`${BASE}?f=json&${params}`, 15000, "VortexMusicApp/1.0 (reproductor web; contacto: vortexmusic.soporte.app@gmail.com)")
  );
  return dedupe((data ?? []).map(toTrack).filter((t): t is Track => t !== null));
}

// Búsqueda por palabra clave (título, artista, tags…).
export function ccmixterSearch(queryStr: string, limit = 20, offset = 0): Promise<Track[]> {
  const q = queryStr.trim();
  if (!q) return Promise.resolve([]);
  // El offset entra en la cadena de parámetros y por tanto en la clave de caché.
  const off = offset > 0 ? `&offset=${offset}` : "";
  return query(`any=${encodeURIComponent(q)}&limit=${limit}${off}`, 30 * 60_000);
}

// Canciones por etiqueta de género (p. ej. "rock", "jazz", "latin").
// offset: página aleatoria para la rotación de radios.
export function ccmixterByTag(tag: string, limit = 16, offset = 0): Promise<Track[]> {
  const t = tag.trim();
  if (!t) return Promise.resolve([]);
  const off = offset > 0 ? `&offset=${offset}` : "";
  return query(`tags=${encodeURIComponent(t)}&limit=${limit}${off}`, 60 * 60_000);
}

// Selección destacada para la portada (orden por valoración de la comunidad).
// offset: página aleatoria para la rotación de "Novedades libres".
export function ccmixterFeatured(limit = 20, offset = 0): Promise<Track[]> {
  const off = offset > 0 ? `&offset=${offset}` : "";
  return query(`limit=${limit}${off}`, 60 * 60_000);
}

// Perfil del artista de ccMixter: sus subidas como canciones populares.
export async function ccmixterArtistDetail(
  userName: string
): Promise<{ artist: Artist; topSongs: Track[] } | null> {
  const name = decodeURIComponent(userName);
  if (!name) return null;
  try {
    const uploads = await cached<CcmixterUpload[]>(
      `ccm:artist:${name.toLowerCase()}`,
      60 * 60_000,
      () =>
        fetchJsonLenient<CcmixterUpload[]>(
          `${BASE}?f=json&user=${encodeURIComponent(name)}&limit=40`,
          15000,
          "VortexMusicApp/1.0 (reproductor web; contacto: vortexmusic.soporte.app@gmail.com)"
        )
    );
    const topSongs = dedupe(
      (uploads ?? []).map(toTrack).filter((t): t is Track => t !== null)
    ).sort((a, b) => b.duration - a.duration);
    if (topSongs.length === 0) return null;
    return {
      artist: {
        id: `cc-${encodeURIComponent(name)}`,
        name: uploads[0]?.user_real_name?.trim() || name,
        artwork: null,
        genre: "ccMixter",
      },
      topSongs,
    };
  } catch {
    return null;
  }
}

// Resolución de versión completa por título en ccMixter (usada por el reporductor).
export async function ccmixterResolve(
  title: string,
  artist: string,
  catalogDuration: number
): Promise<Track | null> {
  try {
    const results = await ccmixterSearch(title, 20);
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
