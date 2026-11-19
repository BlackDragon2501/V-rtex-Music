import type { Album, Artist, ArtistDetail, Track } from "./types";
import { normalize } from "./match";
// Guardián de formato MP3: filtro estricto por extensión y error tipado para
// discos sin un solo .mp3 (la vista muestra un mensaje claro, no un fallo).
import { isMp3FileName, NoMp3Error, NO_MP3_MESSAGE } from "./mp3";

// ============ Internet Archive desde el NAVEGADOR (búsqueda client-side) =====
//
// Por qué existe este módulo: Internet Archive aplica su anti-abuso contra
// IPs de datacenter (nginx responde 429 a cualquier petición server-side
// desde entornos cloud). El navegador del usuario, en cambio, tiene una IP
// doméstica normal y archive.org le sirve todo sin problema. Además el audio
// ya se reproduce client-side (streamUrl directo a archive.org/download), así
// que esta pieza completa el circuito: búsqueda → metadatos → reproducción,
// todo desde el navegador.
//
// Estrategia:
//   1. advancedsearch.php vía fetch() (IA permite CORS en búsqueda).
//   2. Si el fetch falla (CORS cortado, 429…), reintento por JSONP
//      (`&callback=…`, mecanismo legacy que advancedsearch sigue soportando).
//   3. Metadatos de cada objeto vía /metadata/<id> (fetch, CORS *, con caché
//      en memoria: la misma respuesta sirve para canciones, álbumes y artistas).
//   4. Cualquier fallo devuelve [] sin romper la vista: IA es una fuente más,
//      no un requisito.
//
// ÁLBUMES: cada objeto de IA con ≥2 pistas reproducibles ES un disco (el
// campo `album` del metadato manda si existe, si no el título del objeto).
// Esto es genérico: cualquier disco que el usuario (o cualquiera) suba en el
// futuro aparece como álbum sin configurar nada.
//
// NOTA: los helpers están duplicados a propósito de archive.ts (que importa
// node:https vía cache.ts y NO puede entrar en el bundle del navegador).
//
// NEXT_PUBLIC_IA_BASE permite apuntar la fuente a un relé propio (p. ej.
// un proxy self-hosted de archive.org) sin tocar código. Vacío = archive.org.

const BASE = (process.env.NEXT_PUBLIC_IA_BASE || "https://archive.org").replace(/\/+$/, "");

// Colecciones de libre distribución/DMCA-moderadas en las que buscamos. Incluye
// community_audio y etree (directos aprobados por los artistas) además de
// opensource_audio: ahí viven los discos que los usuarios suben por su cuenta,
// p. ej. el propio disco de un artista independiente.
const SEARCH_COLLECTIONS =
  "(netlabels OR opensource_audio OR community_audio OR etree OR 78rpms OR georgeblood)";

const MIN_SECS = 60;
const MAX_SECS = 1800; // solo canciones, igual que el resto de fuentes
const MAX_BYTES = 90 * 1024 * 1024;
const TOP_DOCS = 12; // objetos expandidos por búsqueda
const ARTIST_DOCS = 20; // objetos expandidos al construir la página de artista
const CACHE_TTL = 10 * 60_000;
const META_TTL = 30 * 60_000; // los metadatos de un objeto casi nunca cambian
const MAX_ARTIST_TRACKS = 150; // techo de seguridad para creadores muy prolíficos

// Cuántas pistas puede aportar UN objeto a una búsqueda:
//  · Si lo buscado apunta a ese objeto CONCRETO (su título o su creador
//    contienen los términos: "Jaguar del Alba", "Herida Eterna"…), el usuario
//    quiere el disco entero → aporta TODO su contenido (discos de 12, 20
//    pistas…). Funciona también para subidas futuras: nada queda atado a un
//    álbum concreto.
//  · Si es una búsqueda genérica, cap moderado para diversificar fuentes.
const GENERIC_PER_ITEM = 6;
const MATCHED_PER_ITEM = 60;
const ALBUM_PER_ITEM = 99; // vista de álbum: el disco completo, sin recortes

// ---------- tipos de la API de IA ----------
interface IaDoc {
  identifier?: string;
  title?: string | string[];
  creator?: string | string[];
  year?: string | number;
}

interface IaSearchResponse {
  response?: { docs?: IaDoc[] };
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

// ---------- utilidades (espejo de archive.ts) ----------
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

function mp3Rank(format?: string): number {
  const fmt = (format ?? "").trim();
  if (fmt === "VBR MP3") return 4;
  const m = /^(\d{2,3})Kbps MP3$/i.exec(fmt);
  if (m) return Number(m[1]) >= 128 ? 3 : 2;
  if (/^MP3$/i.test(fmt)) return 2;
  if (/MP3/i.test(fmt)) return 1;
  return 0;
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\.mp3$/i, "")
    .replace(/^\s*\d{1,3}[\s._-]+/, "")
    // Derivados de IA: "canción_64kb.mp3" es la MISMA pista que "canción.mp3"
    // en peor calidad, no una canción nueva: el sufijo de calidad se quita
    // para que el dedup por título los fusione (gana el derivado mejor).
    .replace(/[\s_-]+(64|96|112|128|192|224|256|320)kb$/i, "")
    .replace(/_+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Proporción de términos de la consulta (≥2 letras) presentes en un texto,
// sin acentos ni mayúsculas ("Traición" y "traicion" empatan). 1 = todos.
function matchRatio(q: string, hay: string): number {
  const tokens = normalize(q)
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return 0;
  const text = normalize(hay);
  const hits = tokens.filter((t) => text.includes(t)).length;
  return hits / tokens.length;
}

// Tope de pistas que aporta un objeto según la consulta del usuario.
function perItemCap(q: string | undefined, itemTitle: string, creator: string): number {
  if (!q) return MATCHED_PER_ITEM;
  return matchRatio(q, `${itemTitle} ${creator}`) >= 0.6 ? MATCHED_PER_ITEM : GENERIC_PER_ITEM;
}

// Ordena documentos por cuánto coinciden con la consulta (los que apuntan al
// disco/artista buscado se expanden SIEMPRE primero, aunque la relevancia
// bruta de IA los mezcle con ruido).
function byMatchDesc(query: string): (a: IaDoc, b: IaDoc) => number {
  const score = (d: IaDoc) => matchRatio(query, `${asStr(d.title)} ${asStr(d.creator)}`);
  return (a, b) => score(b) - score(a);
}

// ---------- transporte con fallback JSONP ----------
function jsonp<T>(url: string, timeoutMs = 12000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cb = `__iaCb${Math.random().toString(36).slice(2)}`;
    const w = window as unknown as Record<string, unknown>;
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("IA JSONP: tiempo agotado"));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      delete w[cb];
      script.remove();
    };
    w[cb] = (data: unknown) => {
      cleanup();
      resolve(data as T);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("IA JSONP: fallo de red o callback no soportado"));
    };
    script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${cb}`;
    document.head.appendChild(script);
  });
}

async function searchDocs(q: string, rows: number): Promise<IaDoc[]> {
  const params = new URLSearchParams();
  params.set("q", q);
  for (const f of ["identifier", "title", "creator", "year"]) params.append("fl[]", f);
  params.set("rows", String(rows));
  params.set("page", "1");
  params.set("output", "json");
  const url = `${BASE}/advancedsearch.php?${params.toString()}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as IaSearchResponse;
    return data.response?.docs ?? [];
  } catch {
    // CORS bloqueado / 429 / red → JSONP legacy de advancedsearch.
    try {
      const data = await jsonp<IaSearchResponse>(url);
      return data.response?.docs ?? [];
    } catch {
      return [];
    }
  }
}

async function itemMetadata(identifier: string): Promise<IaMetadata | null> {
  try {
    const res = await fetch(`${BASE}/metadata/${encodeURIComponent(identifier)}`, {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as IaMetadata;
  } catch {
    return null;
  }
}

// ---------- cachés en memoria del navegador ----------
// Docs por consulta: una SOLA petición de búsqueda sirve para las canciones,
// los álbumes y las tarjetas de artista de la misma búsqueda. Los metadatos
// por objeto se comparten entre llamadas (abrir el álbum tras buscar = gratis).
const docsMemo = new Map<string, { t: number; docs: IaDoc[] }>();
const tracksMemo = new Map<string, { t: number; tracks: Track[] }>();
const metaMemo = new Map<string, { t: number; md: IaMetadata }>();

function isFresh(e: { t: number } | undefined, ttl = CACHE_TTL): boolean {
  return !!e && Date.now() - e.t < ttl;
}

async function getDocs(query: string, rows: number): Promise<IaDoc[]> {
  const key = `${query.toLowerCase()}:${rows}`;
  const hit = docsMemo.get(key);
  if (isFresh(hit)) return hit!.docs;
  const q = `${query.trim()} AND mediatype:(audio) AND format:(MP3) AND collection:${SEARCH_COLLECTIONS}`;
  const docs = (await searchDocs(q, rows)).filter((d) => !!d.identifier);
  // Solo cacheamos resultados POSITIVOS: un [] (red caída, 429 momentáneo)
  // no debe congelar la fuente durante el TTL; la siguiente búsqueda reintenta.
  if (docs.length > 0) docsMemo.set(key, { t: Date.now(), docs });
  return docs;
}

async function itemMetadataCached(identifier: string): Promise<IaMetadata | null> {
  const hit = metaMemo.get(identifier);
  if (isFresh(hit, META_TTL)) return hit!.md;
  const md = await itemMetadata(identifier);
  if (md) {
    // Poda simple para no crecer sin límite en sesiones muy largas.
    if (metaMemo.size > 80) {
      const oldest = [...metaMemo.entries()].sort((a, b) => a[1].t - b[1].t).slice(0, 20);
      for (const [k] of oldest) metaMemo.delete(k);
    }
    metaMemo.set(identifier, { t: Date.now(), md });
  }
  return md; // un fallo no se cachea: el siguiente intento reintenta
}

// ---------- conversión de un objeto IA a pistas de Vórtex ----------
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
  doc: IaDoc,
  md: IaMetadata,
  query: string | undefined,
  cap: number
): Track[] {
  const restricted = md.metadata?.["access-restricted-item"];
  if (restricted === true || restricted === "true") return [];

  const itemTitle = asStr(md.metadata?.title) || asStr(doc.title) || identifier;
  const creator = asStr(md.metadata?.creator) || asStr(doc.creator) || "Internet Archive";
  const albumMeta = asStr(md.metadata?.album);

  // FILTRO ESTRICTO .mp3: la extensión del archivo manda, no el metadato de
  // IA (puede venir vacío o mal etiquetado en subidas de usuarios). Solo pasan
  // archivos que terminan en .mp3; .wav/.flac/.ogg, imágenes y texto se
  // ignoran: el reproductor nunca recibe un códec que no soporta.
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
        isMp3FileName(x.f.name) && // ← estricto: solo .mp3
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
  // Sin consulta (vista de álbum / página de artista): manda el cap del caller.
  const limit = Math.min(cap, query ? perItemCap(query, itemTitle, creator) : cap);
  const out: Track[] = [];
  const taken = new Set<string>(); // títulos ya aportados por este objeto
  for (const { f } of candidates) {
    if (out.length >= limit) break;
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
      // Navegar al artista desde la propia fila ("Ir al artista").
      artistId: `ia-${encodeURIComponent(creator)}`,
      // El campo `album` del metadato manda; si no, objetos multipista usan
      // su título como disco (un objeto IA suelto no es un álbum).
      album: albumMeta || (multi ? itemTitle : undefined),
      artwork: `${BASE}/services/img/${encodeURIComponent(identifier)}`,
      duration: parseLength(f.length),
      // MP3 directo: /download redirige al nodo de ficheros de IA y soporta
      // Range; el navegador del usuario lo reproduce sin intermediarios.
      streamUrl: `${BASE}/download/${encodeURIComponent(identifier)}/${name
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
      preview: false, // archivo COMPLETO de colección de libre distribución
    });
  }
  return out;
}

// Un objeto con ≥2 pistas reproducibles es un disco; los de una sola pista
// (singles, pizarra, ruido de búsqueda) no generan tarjeta de álbum.
function buildAlbum(identifier: string, doc: IaDoc, md: IaMetadata, tracks: Track[]): Album | null {
  if (tracks.length < 2) return null;
  const creator = asStr(md.metadata?.creator) || asStr(doc.creator) || "Internet Archive";
  const title =
    asStr(md.metadata?.album) || asStr(md.metadata?.title) || asStr(doc.title) || identifier;
  return {
    id: `ia-album-${identifier}`,
    source: "archive",
    title,
    artist: creator,
    artistId: `ia-${encodeURIComponent(creator)}`,
    year: asStr(md.metadata?.date) || asStr(doc.year) || undefined,
    artwork: `${BASE}/services/img/${encodeURIComponent(identifier)}`,
    trackCount: tracks.length,
    tracks,
  };
}

// Discos duplicados (misma subida repetida) no deben repetir tarjeta.
function pushAlbum(list: Album[], seen: Set<string>, album: Album | null): void {
  if (!album) return;
  const k = `${album.title.toLowerCase()}|${album.artist.toLowerCase()}`;
  if (seen.has(k)) return;
  seen.add(k);
  list.push(album);
}

// ---------- expansión combinada (una ola IA → canciones + álbumes + artistas) ----------
export interface IaBundle {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
}

export async function iaBrowserBundle(query: string, trackLimit = 40): Promise<IaBundle> {
  const q = query.trim();
  const empty: IaBundle = { tracks: [], albums: [], artists: [] };
  if (q.length < 2) return empty;

  const docs = await getDocs(q, 25);
  if (docs.length === 0) return empty;

  // Los objetos que apuntan directo a lo buscado se expanden primero.
  const valid = [...docs].sort(byMatchDesc(q)).slice(0, TOP_DOCS);
  const mds = await Promise.allSettled(valid.map((d) => itemMetadataCached(d.identifier!)));

  const tracks: Track[] = [];
  const seenTrack = new Set<string>();
  const albums: Album[] = [];
  const seenAlbum = new Set<string>();
  const artists: Artist[] = [];
  const seenArtist = new Set<string>();

  mds.forEach((r, i) => {
    const doc = valid[i];
    const identifier = doc.identifier!;
    const md = r.status === "fulfilled" ? r.value : null;

    // El artista se deduce aunque los metadatos fallen (el doc lo trae).
    const creator = asStr(md?.metadata?.creator) || asStr(doc.creator);
    if (
      creator &&
      creator !== "Internet Archive" &&
      // Regla estricta: el creador es resultado cuando su nombre contiene
      // TODOS los términos, o cuando el objeto buscado es suyo (p. ej. buscar
      // el nombre del DISCO también debe surface al artista).
      (matchRatio(q, creator) >= 1 || matchRatio(q, asStr(doc.title)) >= 1)
    ) {
      const ck = creator.toLowerCase();
      if (!seenArtist.has(ck)) {
        seenArtist.add(ck);
        artists.push({
          id: `ia-${encodeURIComponent(creator)}`,
          name: creator,
          artwork: `${BASE}/services/img/${encodeURIComponent(identifier)}`,
          genre: "Internet Archive",
        });
      }
    }

    if (!md) return; // sin metadatos no hay pistas ni álbum de este objeto
    const itemTracks = toTracks(identifier, doc, md, q, MATCHED_PER_ITEM);
    if (itemTracks.length >= 2) {
      pushAlbum(albums, seenAlbum, buildAlbum(identifier, doc, md, itemTracks));
    }
    for (const t of itemTracks) {
      if (tracks.length >= trackLimit) break;
      const k = `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;
      if (seenTrack.has(k)) continue;
      seenTrack.add(k);
      tracks.push(t);
    }
  });

  return { tracks, albums, artists };
}

// ---------- API pública ----------

// Búsqueda de música en Internet Archive desde el navegador del usuario.
// Devuelve [] ante cualquier fallo (la fuente es opcional, nunca bloquea).
export async function iaBrowserSearch(query: string, limit = 30): Promise<Track[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const key = `${q.toLowerCase()}|${limit}`;
  const hit = tracksMemo.get(key);
  if (isFresh(hit)) return hit!.tracks;

  const { tracks } = await iaBrowserBundle(q, limit);
  if (tracks.length > 0) tracksMemo.set(key, { t: Date.now(), tracks });
  return tracks;
}

// Álbumes (objetos IA con varias pistas) que coinciden con la consulta.
export async function iaBrowserAlbums(query: string, max = 12): Promise<Album[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { albums } = await iaBrowserBundle(q, 0);
  return albums.slice(0, max);
}

// Artistas (creadores de IA) que coinciden con la consulta. Regla estricta:
// todos los términos deben estar en el nombre del creador O en el título del
// objeto cuyo creador es (buscar "Herida Eterna" sí surface a su artista;
// una coincidencia suelta, no).
export async function iaBrowserArtists(query: string, max = 6): Promise<Artist[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { artists } = await iaBrowserBundle(q, 0);
  return artists.slice(0, max);
}

// Vista de álbum: el objeto completo con TODAS sus pistas MP3 en orden de
// disco. Si el objeto no existe o no se pudo leer → error genérico (la vista
// muestra "Algo salió mal" con reintento). Si existe pero NO tiene NI UN
// archivo .mp3 → NoMp3Error tipado: la vista muestra "Este álbum no contiene
// archivos MP3 compatibles" en lugar del error genérico.
export async function iaBrowserAlbumDetail(
  albumId: string
): Promise<{ album: Album; tracks: Track[] }> {
  if (!albumId.startsWith("ia-album-")) throw new Error("Álbum no encontrado");
  const identifier = decodeURIComponent(albumId.slice("ia-album-".length)).trim();
  if (!identifier) throw new Error("Álbum no encontrado");

  const md = await itemMetadataCached(identifier);
  if (!md) throw new Error("No se pudo cargar el álbum desde Internet Archive");

  const doc: IaDoc = {
    identifier,
    title: md.metadata?.title,
    creator: md.metadata?.creator,
    year: asStr(md.metadata?.date) || undefined,
  };
  const tracks = toTracks(identifier, doc, md, undefined, ALBUM_PER_ITEM);
  if (tracks.length === 0) {
    // El objeto existe pero solo trae FLAC/WAV/OGG, imágenes o texto (o los
    // derivados MP3 aún no se generaron): mensaje claro, sin "Algo salió mal".
    throw new NoMp3Error(NO_MP3_MESSAGE);
  }
  const creator = asStr(md.metadata?.creator) || asStr(doc.creator) || "Internet Archive";
  const title =
    asStr(md.metadata?.album) || asStr(md.metadata?.title) || asStr(doc.title) || identifier;
  // En la vista de álbum no aplicamos la regla "≥2 pistas" de las tarjetas de
  // búsqueda: un single de 1 pista también es un disco legítimo.
  const album: Album = {
    id: `ia-album-${identifier}`,
    source: "archive",
    title,
    artist: creator,
    artistId: `ia-${encodeURIComponent(creator)}`,
    year: asStr(md.metadata?.date) || asStr(doc.year) || undefined,
    artwork: `${BASE}/services/img/${encodeURIComponent(identifier)}`,
    trackCount: tracks.length,
    tracks,
  };
  return { album, tracks };
}

// Página de artista de Internet Archive: TODO el catálogo subido por ese
// creador (cada objeto nuevo que suba en el futuro aparece solo), además de
// sus álbumes agrupados objeto por objeto.
// Lanza error si el creador no tiene audio reproducible: la vista muestra
// su estado de error con reintento.
export async function iaBrowserArtistDetail(id: string): Promise<ArtistDetail> {
  if (!id.startsWith("ia-")) throw new Error("Artista no encontrado");
  let creator = "";
  try {
    creator = decodeURIComponent(id.slice(3));
  } catch {
    creator = id.slice(3);
  }
  creator = creator.trim();
  if (!creator) throw new Error("Artista no encontrado");

  const quoted = `"${creator.replace(/"/g, "")}"`;
  const docs = await getDocs(`creator:${quoted}`, 40);
  const valid = [...docs].sort(byMatchDesc(creator)).slice(0, ARTIST_DOCS);
  const mds = await Promise.allSettled(valid.map((d) => itemMetadataCached(d.identifier!)));

  const topSongs: Track[] = [];
  const seenTrack = new Set<string>();
  const albums: Album[] = [];
  const seenAlbum = new Set<string>();

  mds.forEach((r, i) => {
    if (r.status !== "fulfilled" || !r.value) return;
    // Defensa ante el ruido del buscador de IA: la página de un artista solo
    // incluye objetos creados por él (comparación sin acentos ni mayúsculas,
    // tolerante a creadores múltiples "A & B").
    const itemCreator = asStr(r.value.metadata?.creator) || asStr(valid[i].creator);
    const artistKey = normalize(creator);
    const itemKey = normalize(itemCreator);
    if (!itemKey.includes(artistKey) && !artistKey.includes(itemKey)) return;
    const identifier = valid[i].identifier!;
    const itemTracks = toTracks(identifier, valid[i], r.value, undefined, MATCHED_PER_ITEM);
    if (itemTracks.length >= 2) {
      pushAlbum(albums, seenAlbum, buildAlbum(identifier, valid[i], r.value, itemTracks));
    }
    for (const t of itemTracks) {
      if (topSongs.length >= MAX_ARTIST_TRACKS) break;
      const k = `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;
      if (seenTrack.has(k)) continue;
      seenTrack.add(k);
      topSongs.push(t);
    }
  });
  if (topSongs.length === 0) throw new Error("No hay audio reproducible de este artista");

  return {
    artist: {
      id: `ia-${encodeURIComponent(creator)}`,
      name: creator,
      artwork: topSongs.find((t) => t.artwork)?.artwork ?? null,
      genre: "Internet Archive",
    },
    topSongs,
    albums,
  };
}
