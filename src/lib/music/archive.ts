import { cached, fetchJson } from "./cache";
import { durationClose, titleMatch, normalize } from "./match";
// Guardián de formato: solo archivos .mp3 llegan al reproductor (FLAC/WAV/OGG,
// imágenes y texto se ignoran aunque el campo `format` de IA venga sucio).
import { isMp3FileName } from "./mp3";
import type { Track } from "./types";

// ============ Cliente de Internet Archive (audio 100% legal y COMPLETO) ======
// Internet Archive (archive.org) hospeda millones de grabaciones de libre
// distribución, sin registro ni API key. Colecciones usadas (todas con
// distribución libre verificada):
//   · netlabels        → discos COMPLETOS de sellos virtuales Creative Commons
//   · opensource_audio → música libre subida por usuarios (moderada por DMCA)
//   · 78rpms / georgeblood → discos históricos de pizarra (dominio público)
// Cada objeto entrega MP3 completos descargables con soporte de Range (seek).
//
// API:
//   · Búsqueda:   advancedsearch.php?q=…&fl[]=identifier&rows=…&page=…&output=json
//   · Metadatos:  metadata/<identifier> → lista de archivos del objeto
//   · Audio:      download/<identifier>/<archivo> (MP3 directo; redirige al nodo)
//   · Portada:    services/img/<identifier>
//
// NOTA DE DESPLIEGUE: IA aplica anti-abuso agresivo contra IPs de datacenter.
// Si el entorno de ejecución no la alcanza, este módulo FALLA RÁPIDO y las
// rutas NO la tratan como fuente obligatoria (ver archiveReachable()): la app
// funciona igual que sin ella y la radio/search/home quedan cacheadas como
// siempre. En cuanto IA responde una sola vez, pasa a exigirse como las demás.

const SEARCH_BASE = "https://archive.org/advancedsearch.php";
const META_BASE = "https://archive.org/metadata";
const DOWNLOAD_BASE = "https://archive.org/download";
const IMG_BASE = "https://archive.org/services/img";

const UA = "VortexMusicApp/1.0 (reproductor web; contacto: vortexmusic.soporte.app@gmail.com)";

const SAFE_COLLECTIONS = "(netlabels OR opensource_audio OR community_audio OR 78rpms OR georgeblood)";

// ---------- salud de la conexión (para el guardián sourceMissing) ----------
let lastReachable = false;
export function archiveReachable(): boolean {
  return lastReachable;
}

// ---------- tipos de la API de IA ----------
interface SearchDoc {
  identifier?: string;
  title?: string | string[];
  creator?: string | string[];
  year?: string | number;
}

interface SearchResponse {
  response?: { numFound?: number; docs?: SearchDoc[] };
}

interface IaFile {
  name?: string;
  format?: string;
  title?: string;
  track?: string;
  length?: string | number;
  size?: string | number;
}

interface IaMetadata {
  metadata?: {
    title?: string | string[];
    creator?: string | string[];
    album?: string | string[];
    date?: string | string[];
    "access-restricted-item"?: boolean | string;
  };
  files?: IaFile[];
}

// ---------- utilidades ----------
// IA a veces devuelve 429 puntual (anti-abuso por ráfaga) aunque la IP no
// esté bloqueada de forma sostenida: una pausa corta y un reintento rescatan
// la respuesta sin cargar el resto de fuentes.
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchIa<T>(url: string): Promise<T> {
  try {
    return await fetchJson<T>(url, 15000, UA);
  } catch (e) {
    if (e instanceof Error && /HTTP 429/.test(e.message)) {
      await sleep(1500);
      return await fetchJson<T>(url, 15000, UA);
    }
    throw e;
  }
}

// "184.35" | 184 | "3:04" | "1:02:33" → segundos
function parseLength(v?: string | number): number {
  if (v === undefined || v === null || v === "") return 0;
  if (typeof v === "number") return Math.round(v);
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  const parts = s.split(":").map((n) => Number(n));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  let secs = 0;
  for (const p of parts) secs = secs * 60 + p;
  return Math.round(secs);
}

function asStr(v?: string | string[] | number | boolean): string {
  if (Array.isArray(v)) return (v[0] ?? "").toString().trim();
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

// 0 = no es MP3; a mayor valor, mejor derivado MP3 del objeto. IA genera
// derivados varios del original (FLAC → VBR MP3, 320/128/64Kbps MP3…).
function mp3Rank(format?: string): number {
  const fmt = (format ?? "").trim();
  if (fmt === "VBR MP3") return 4;
  const m = /^(\d{2,3})Kbps MP3$/i.exec(fmt);
  if (m) return Number(m[1]) >= 128 ? 3 : 2;
  if (/^MP3$/i.test(fmt)) return 2;
  if (/MP3/i.test(fmt)) return 1;
  return 0;
}

// Limpieza de títulos derivados del nombre de archivo: "01 - Track.mp3" →
// "Track", guiones bajos a espacios, sin dobles espacios. Los sufijos de
// calidad de los derivados de IA ("Track_64kb.mp3") se quitan: son la MISMA
// pista en peor calidad y no deben aparecer ni duplicarse.
function cleanTitle(raw: string): string {
  return raw
    .replace(/\.mp3$/i, "")
    .replace(/^\s*\d{1,3}[\s._-]+/, "")
    .replace(/[\s_-]+(64|96|112|128|192|224|256|320)kb$/i, "")
    .replace(/_+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ---------- selección de pistas dentro de un objeto ----------
const MIN_SECS = 60;
const MAX_SECS = 1800; // solo canciones de verdad, igual que el resto de fuentes
const MAX_BYTES = 90 * 1024 * 1024;
const MAX_PER_ITEM = 2; // radios/portada: diversidad entre objetos (cap genérico)

// Búsqueda de usuario: si la consulta apunta a un objeto CONCRETO ("Jaguar del
// Alba", "Herida Eterna"…), el usuario quiere el disco COMPLETO → el objeto
// aporta todas sus pistas. Genérico para cualquier subida, presente o futura.
const SEARCH_MATCH_PER_ITEM = 60;

// Proporción de términos de la consulta (≥2 letras) presentes en un texto,
// sin acentos ni mayúsculas (misma regla que el módulo del navegador).
function matchRatio(q: string, hay: string): number {
  const tokens = normalize(q)
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return 0;
  const text = normalize(hay);
  const hits = tokens.filter((t) => text.includes(t)).length;
  return hits / tokens.length;
}

// Orden natural de disco: número de pista del metadato y, si no lo trae, el
// prefijo numérico del ARCHIVO ("7.La Corona….mp3" → 7). Sin número → al final.
function trackNumber(f: IaFile): number {
  const t = Number(String(f.track ?? "").split("/")[0]);
  if (Number.isFinite(t) && t > 0) return t;
  const m = /^(\d{1,3})[.\s_-]/.exec(f.name ?? "");
  return m ? Number(m[1]) : 99;
}

function toTracks(
  identifier: string,
  doc: SearchDoc,
  md: IaMetadata,
  query?: string,
  cap = MAX_PER_ITEM
): Track[] {
  const restricted = md.metadata?.["access-restricted-item"];
  if (restricted === true || restricted === "true") return []; // requiere cuenta: no es streamable

  const itemTitle = asStr(md.metadata?.title) || asStr(doc.title) || identifier;
  const creator = asStr(md.metadata?.creator) || asStr(doc.creator) || "Internet Archive";
  const albumMeta = asStr(md.metadata?.album);

  // FILTRO ESTRICTO .mp3: la extensión del archivo manda, no el metadato.
  // Un objeto puede traer el original en FLAC/WAV junto a sus derivados MP3
  // (o solo originales sin derivar): aquí solo pasan archivos que terminan en
  // .mp3, así el reproductor nunca recibe un códec que no soporta.
  const candidates = (md.files ?? [])
    .map((f) => ({
      f,
      rank: mp3Rank(f.format),
      len: parseLength(f.length),
      size: Number(asStr(f.size)) || 0,
    }))
    .filter(
      (x) =>
        x.rank > 0 &&
        isMp3FileName(x.f.name) && // ← estricto: solo .mp3 (ignora wav/flac/ogg/imagen/texto)
        !!x.f.name &&
        x.len >= MIN_SECS &&
        x.len <= MAX_SECS &&
        x.size > 0 &&
        x.size <= MAX_BYTES
    );
  if (candidates.length === 0) return []; // sin MP3 → este objeto no aporta pistas

  // Orden de disco (1, 2, 3… y sin número al final) y, a igual pista, mejor
  // derivado de audio.
  candidates.sort((a, b) => trackNumber(a.f) - trackNumber(b.f) || b.rank - a.rank);

  const multi = candidates.length > 1;
  // BUG corregido: antes `Math.min(cap, 60)` dejaba el tope diversificador (2)
  // ganando SIEMPRE, y un disco que apunta directo a la búsqueda aportaba
  // máximo 2 pistas aunque el usuario lo buscara por su nombre. Ahora un
  // objeto que coincide con la búsqueda aporta su disco COMPLETO y el tope
  // solo recorta los resultados genéricos.
  const matched = query ? matchRatio(query, `${itemTitle} ${creator}`) >= 0.6 : false;
  const itemCap = matched ? SEARCH_MATCH_PER_ITEM : Math.min(cap, MAX_PER_ITEM);
  const out: Track[] = [];
  const taken = new Set<string>(); // títulos ya aportados por este objeto
  for (const { f } of candidates) {
    if (out.length >= itemCap) break;
    const name = f.name!;
    const title = cleanTitle(f.title?.trim() || (multi ? name : itemTitle)) || itemTitle;
    if (title.length < 2) continue;
    // Los derivados (_64kb, _128kb…) repiten el título del derivado bueno:
    // no deben gastar cupo del límite por objeto.
    const k = title.toLowerCase();
    if (taken.has(k)) continue;
    taken.add(k);
    out.push({
      id: `ia-${identifier}|${name}`,
      source: "archive",
      title,
      artist: creator,
      artistId: `ia-${encodeURIComponent(creator)}`,
      // El campo `album` del metadato manda; si no, objetos multipista usan
      // su título como disco (un objeto IA suelto no es un álbum).
      album: albumMeta || (multi ? itemTitle : undefined),
      artwork: `${IMG_BASE}/${encodeURIComponent(identifier)}`,
      duration: parseLength(f.length),
      // MP3 directo: /download redirige al nodo de ficheros y soporta Range.
      streamUrl: `${DOWNLOAD_BASE}/${encodeURIComponent(identifier)}/${name
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
      preview: false, // archivo COMPLETO de colección de libre distribución
    });
  }
  return out;
}

// ---------- API de búsqueda y metadatos ----------
async function searchItems(q: string, rows: number, page: number, sort?: string): Promise<SearchDoc[]> {
  const params = new URLSearchParams();
  params.set("q", q);
  for (const f of ["identifier", "title", "creator", "year"]) params.append("fl[]", f);
  params.set("rows", String(rows));
  params.set("page", String(Math.max(1, page)));
  params.set("output", "json");
  if (sort) params.append("sort[]", sort);
  const data = await cached<SearchResponse>(
    `ia:search:${q}:${rows}:${page}:${sort ?? "rel"}`,
    60 * 60_000,
    async () => {
      try {
        const v = await fetchIa<SearchResponse>(`${SEARCH_BASE}?${params.toString()}`);
        lastReachable = true;
        return v;
      } catch (e) {
        lastReachable = false;
        throw e;
      }
    }
  );
  return data.response?.docs ?? [];
}

// Metadatos del objeto (lista de archivos): casi nunca cambian → caché 24 h.
// Un objeto que falla (borrado, 5xx…) no rompe la tanda: devuelve null y se salta.
async function itemMetadata(identifier: string): Promise<IaMetadata | null> {
  try {
    return await cached<IaMetadata>(`ia:item:${identifier}`, 24 * 60 * 60_000, async () => {
      try {
        const v = await fetchIa<IaMetadata>(`${META_BASE}/${encodeURIComponent(identifier)}`);
        lastReachable = true;
        return v;
      } catch (e) {
        lastReachable = false;
        throw e;
      }
    });
  } catch {
    return null;
  }
}

async function composeTracks(docs: SearchDoc[], limit: number, query?: string): Promise<Track[]> {
  const valid = docs.filter((d) => !!d.identifier).slice(0, 16);
  const mds = await Promise.allSettled(valid.map((d) => itemMetadata(d.identifier!)));
  const out: Track[] = [];
  const seen = new Set<string>();
  mds.forEach((r, i) => {
    if (r.status !== "fulfilled" || !r.value) return;
    for (const t of toTracks(valid[i].identifier!, valid[i], r.value, query)) {
      if (out.length >= limit) break;
      const k = `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
  });
  return out;
}

// ---------- API pública del módulo ----------

// Radio por género/etiqueta (p. ej. "metal" sobre colecciones libres).
// page: página aleatoria para la rotación de radios (1 = contenido base).
export async function archiveByQuery(query: string, limit = 24, page = 1): Promise<Track[]> {
  const q = query.trim();
  if (!q) return [];
  const docs = await searchItems(
    `(${q}) AND mediatype:(audio) AND format:(MP3) AND collection:${SAFE_COLLECTIONS}`,
    14,
    page,
    "downloads desc"
  );
  return composeTracks(docs, limit);
}

// Búsqueda del usuario: relevancia (sin sort) sobre las mismas colecciones.
// rows=25: discos completos de un mismo artista deben caber en una búsqueda.
export async function archiveSearch(query: string, limit = 15): Promise<Track[]> {
  const q = query.trim();
  if (!q) return [];
  const docs = await searchItems(
    `(${q}) AND mediatype:(audio) AND format:(MP3) AND collection:${SAFE_COLLECTIONS}`,
    25,
    1
  );
  return composeTracks(docs, limit, q);
}

// Portada ("Sonidos libres"): lo más descargado de colecciones libres modernas.
export async function archiveHome(limit = 18, page = 1): Promise<Track[]> {
  const docs = await searchItems(
    `mediatype:(audio) AND format:(MP3) AND collection:${SAFE_COLLECTIONS} AND year:[2000 TO *]`,
    14,
    page,
    "downloads desc"
  );
  return composeTracks(docs, limit);
}

// Resolución de versión completa por título (usada por el reproductor).
export async function archiveResolve(
  title: string,
  artist: string,
  catalogDuration: number
): Promise<Track | null> {
  try {
    const results = await archiveSearch(title, 10);
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
