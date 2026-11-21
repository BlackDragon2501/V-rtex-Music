// Helpers de coincidencia difusa título/artista/duración para resolver
// versiones COMPLETAS de una canción en catálogos alternativos (Audius,
// Jamendo/ccMixter/FMA vía Openverse) cuando solo hay un avance de 30 s.

// Alfabetos ajenos a los géneros de Vórtex (devanagari, árabe, samaritano…):
// un título con este alfabeto en una radio de metal/rock/jazz/reggaetón es
// ruido de metadatos de los catálogos, no música del género. Cirílico, CJK y
// latín NO están en estos rangos, así que las radios rusas/chinas quedan intactas.
export const FOREIGN_SCRIPT = /[\u0900-\u097F\u0600-\u06FF\u0800-\u083F]/;

// Guiones japoneses (hiragana, katakana, katakana de media anchura) y kanji
// (compartido con el chino): detecta contenido genuinamente japonés en títulos
// y nombres de artista. Usado por la radio de Audius de Japón para conservar
// solo pistas verdaderamente japonesas entre los resultados de búsqueda.
export const JP_SCRIPT = /[\u3040-\u30FF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\u9FFF\uFF66-\uFF9D]/;

// Marcadores japoneses en romaji: para pistas SIN guion japonés (títulos
// romanizados por el uploader) exige una palabra japonesa reconocible.
// Usado por las radios de Japón para acotar el ruido no japonés que llega
// etiquetado como jpop/japan en Jamendo (verificado: "Fotinye", ucraniano;
// "{jazzn' beat}"…): sin guion japonés NI marcador romaji → fuera del pool.
export const JP_ROMAN =
  /j-?pop|j-?rock|japan(ese)?|nihon|nippon|tokyo|kyoto|osaka|sakura|vocaloid|utau|touhou|anime|shamisen|shakuhachi|\bkoto\b|gagaku|biwa|taiko|kayokyoku|enka|ryukyu|okinawa|kisarazu/i;

// Detecta títulos-basura que se cuelan en los catálogos libres: vídeos de
// estados de WhatsApp/TikTok, tonos de llamada y archivos con el nombre
// URL-encoded (p. ej. "%F0%9F%92%96New_Whatsapp_Status_Video…"). Decodifica
// antes de evaluar para ver el contenido real.
export function junkTitle(raw: string): boolean {
  if (!raw) return false;
  let title = raw;
  try {
    title = decodeURIComponent(raw);
  } catch {
    /* título con % suelto: se evalúa tal cual */
  }
  if (FOREIGN_SCRIPT.test(title)) return true;
  if (/(whatsapp|status[\s_-]?video|ringtone|tiktok[\s_-]?video)/i.test(title)) return true;
  // Secuencias URL-encoded de varios bytes que sobreviven a la decodificación.
  if (/%[0-9A-Fa-f]{2}%[0-9A-Fa-f]{2}%[0-9A-Fa-f]{2}/.test(raw)) return true;
  return false;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\((feat|ft|with)\.?\s*[^)]*\)/g, "")
    .replace(/\[(.*?)\]/g, "")
    .replace(/\s*(-|–|—)\s*(remix|radio edit|single version|live).*$/, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(feat|ft)\b.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Título contenido en el otro (p. ej. "Yellow - Single" vs "Yellow").
  if (na.length >= 4 && nb.length >= 4 && (nb.startsWith(na) || na.startsWith(nb))) return true;
  return false;
}

export function artistMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 3 && nb.length >= 3 && (nb.startsWith(na) || na.startsWith(nb))) return true;
  return false;
}

// Tolerancia de duración: ±8 s mínimo o ±6 % del catálogo.
export function durationClose(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false;
  const tol = Math.max(8, Math.round(Math.max(a, b) * 0.06));
  return Math.abs(a - b) <= tol;
}

// ---------- filtro ESTRICTO de la pestaña Canciones ----------
// El usuario busca un artista ("Jaguar del Alba") o un disco ("Herida Eterna"):
// la pestaña de canciones no debe mostrar nada de otros artistas. Regla:
// TODOS los términos de la búsqueda (≥2 letras, sin acentos) deben aparecer
// en título + artista + álbum de la pista. Con un solo término no se filtra
// (las búsquedas por género/tag ya rankean por relevancia en cada fuente).
export function queryTokens(q: string): string[] {
  return normalize(q)
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

export function trackMatchesQuery(
  q: string,
  t: { title: string; artist: string; album?: string }
): boolean {
  const tokens = queryTokens(q);
  if (tokens.length < 2) return true; // término único: sin corte estricto
  const hay = normalize(`${t.title} ${t.artist} ${t.album ?? ""}`);
  return tokens.every((tk) => hay.includes(tk));
}

// Igual criterio estricto para perfiles de artista del servidor: TODOS los
// términos deben estar en el nombre (evita coincidencias difusas ajenas, p.
// ej. buscar "Jaguar del Alba" y que aparezca "Beto"). Los artistas de
// Internet Archive no se re-filtran: su módulo ya exige coincidencia total
// del nombre del creador O del título del disco que se buscó.
export function artistMatchesQuery(q: string, name: string): boolean {
  const tokens = queryTokens(q);
  if (tokens.length < 2) return true;
  const hay = normalize(name);
  return tokens.every((tk) => hay.includes(tk));
}
