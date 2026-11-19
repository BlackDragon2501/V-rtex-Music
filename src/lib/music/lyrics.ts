import { cached, fetchJson } from "./cache";

// ============ Cliente LRCLIB (letras sincronizadas LRC, gratis y sin API key) ============
// LRCLIB (lrclib.net) devuelve letras con marcas de tiempo por línea, ideales
// para el panel de letra sincronizada estilo Apple Music / Spotify.

const BASE = "https://lrclib.net";
const UA = "VortexMusic/1.0 (web player; synced lyrics)";

export interface LyricLine {
  t: number; // segundos desde el inicio
  text: string;
}

export interface LyricsPayload {
  synced: boolean;
  lines: LyricLine[];
  plain: string;
  provider: string;
}

interface LrcLibResult {
  id?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

// Parsea el formato LRC: "[mm:ss.xx] texto" (admite varias marcas por línea).
export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
    if (stamps.length === 0) continue;
    const text = raw.replace(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g, "").trim();
    for (const m of stamps) {
      const min = parseInt(m[1], 10);
      const sec = parseFloat(m[2].replace(":", "."));
      if (!isFinite(min) || !isFinite(sec)) continue;
      out.push({ t: min * 60 + sec, text });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

function fromResult(r: LrcLibResult): LyricsPayload {
  const lines = r.syncedLyrics ? parseLrc(r.syncedLyrics) : [];
  if (lines.length > 0) {
    return { synced: true, lines, plain: r.plainLyrics ?? "", provider: "LRCLIB" };
  }
  if (r.instrumental) {
    return { synced: false, lines: [], plain: "", provider: "LRCLIB" };
  }
  return { synced: false, lines: [], plain: r.plainLyrics ?? "", provider: "LRCLIB" };
}

export async function fetchLyrics(
  title: string,
  artist: string,
  durationSec: number
): Promise<LyricsPayload | null> {
  if (!title || !artist) return null;

  // 1) Coincidencia exacta con duración (la más precisa para sincronizar).
  try {
    const url =
      `${BASE}/api/get?artist_name=${encodeURIComponent(artist)}` +
      `&track_name=${encodeURIComponent(title)}` +
      (durationSec > 0 ? `&duration=${Math.round(durationSec)}` : "");
    const res = await fetch(url, {
      signal: AbortSignal.timeout(9000),
      headers: { "User-Agent": UA },
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as LrcLibResult;
      if (data && (data.syncedLyrics || data.plainLyrics || data.instrumental)) {
        return fromResult(data);
      }
    }
  } catch {
    /* seguir con la búsqueda */
  }

  // 2) Búsqueda aproximada: elegir la versión sincronizada con duración más cercana.
  try {
    const url = `${BASE}/api/search?q=${encodeURIComponent(`${artist} ${title}`)}`;
    const data = await fetchJson<LrcLibResult[]>(url, 9000, UA);
    const results = Array.isArray(data) ? data : [];
    if (results.length === 0) return null;

    const scored = results
      .map((r) => {
        const hasSynced = Boolean(r.syncedLyrics);
        const durDelta =
          durationSec > 0 && r.duration ? Math.abs(r.duration - durationSec) : 9999;
        // Prioridad: sincronizada > delta de duración pequeño.
        return { r, score: (hasSynced ? 0 : 10000) + Math.min(durDelta, 9999) };
      })
      .sort((a, b) => a.score - b.score);

    const best = scored[0]?.r;
    if (!best) return null;
    return fromResult(best);
  } catch {
    return null;
  }
}
