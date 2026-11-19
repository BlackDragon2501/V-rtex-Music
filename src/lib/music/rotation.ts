import type { Track } from "./types";

// ===== Rotación de catálogo para Tendencias y Radios =====
// Objetivo: que cada visita ofrezca canciones distintas y no se repitan dentro
// de la misma sesión. Dos mecanismos combinados:
//
//  1. OFFSET ALEATORIO: cada "generación" de catálogo (15 min) pide a las APIs
//     una página distinta (offset/page aleatorio verificado en las 5 fuentes),
//     así el POOL de canciones disponibles se renueva a lo largo del día sin
//     desbordar las cuotas de las APIs (el pool se cachea por generación).
//
//  2. REGISTRO DE SESIÓN: el servidor recuerda (en memoria, con TTL) qué IDs
//     ya se mostraron a cada sesión y al responder elige del pool las
//     canciones todavía NO vistas. Si el pool entero ya se mostró, el ciclo
//     reinicia mezclado: nunca hay pantalla vacía ni congelada.

// ---------- 1. Offset aleatorio ----------

// Elige un "paso" aleatorio en [0, maxSteps); el llamador lo convierte al
// offset o página que entienda cada API. El paso 0 es siempre el contenido
// base verificado (las primeras páginas de cada fuente).
export function randomStep(maxSteps: number): number {
  return Math.floor(Math.random() * Math.max(1, maxSteps));
}

// Carga con paso aleatorio; si la página avanzada vuelve vacía o MUY débil
// (menos de minOk pistas: catálogos pequeños, fin de resultados) se fusiona con
// el contenido base del paso 0 para que la radio nunca pierde su acervo.
export async function rotatedLoad(
  maxSteps: number,
  load: (step: number) => Promise<Track[]>,
  minOk = 10
): Promise<Track[]> {
  const step = randomStep(maxSteps);
  if (step === 0) return load(0);
  const rotated = await load(step);
  if (rotated.length >= minOk) return rotated;
  const base = await load(0);
  // Fusión sin duplicados (rotado primero: trae novedad; base garantiza volumen).
  const seen = new Set<string>();
  const merged: Track[] = [];
  for (const t of [...rotated, ...base]) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    merged.push(t);
  }
  return merged;
}

// Generación del pool: cambia cada 15 min para que los offsets aleatorios
// traigan canciones nuevas aunque el servidor lleve horas encendido. Las
// claves de caché del pool incluyen este bucket.
const BUCKET_MS = 15 * 60_000;
export function poolBucket(): string {
  return Math.floor(Date.now() / BUCKET_MS).toString(36);
}

// ---------- 2. Registro de sesión (memoria del servidor) ----------

// Una canción mostrada no vuelve hasta 60 min después (sesiones largas) o
// hasta que el pool entero se haya mostrado (el ciclo reinicia).
const SHOWN_TTL = 60 * 60_000;
const SHOWN_MAX = 500; // tope de IDs recordados por sesión
const STORE_MAX = 80; // tope de sesiones recordadas (limpieza por inactividad)

const shownStore = new Map<string, { ids: Map<string, number>; t: number }>();

function getScope(scope: string): { ids: Map<string, number>; t: number } {
  let r = shownStore.get(scope);
  if (!r) {
    r = { ids: new Map(), t: Date.now() };
    shownStore.set(scope, r);
  }
  r.t = Date.now();
  return r;
}

function pruneStore(): void {
  const now = Date.now();
  for (const [k, r] of shownStore) {
    if (now - r.t > SHOWN_TTL * 4) shownStore.delete(k);
  }
  if (shownStore.size > STORE_MAX) {
    const oldest = [...shownStore.entries()].sort((a, b) => a[1].t - b[1].t);
    for (let i = 0; i < shownStore.size - STORE_MAX; i++) shownStore.delete(oldest[i][0]);
  }
}

// Reinicia la memoria anti-repetición de TODAS las sesiones. La llama el cron
// de rotación diaria: cada jornada arranca un ciclo limpio y la portada vuelve
// a ofrecer el catálogo completo aunque el servidor lleve días encendido.
// Devuelve cuántas sesiones había recordadas (para el log del programador).
export function resetRotationMemory(): number {
  const n = shownStore.size;
  shownStore.clear();
  return n;
}

function markShown(scope: string, tracks: Track[]): void {
  const r = getScope(scope);
  const now = Date.now();
  for (const t of tracks) r.ids.set(t.id, now);
  if (r.ids.size > SHOWN_MAX) {
    const oldest = [...r.ids.entries()].sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < r.ids.size - SHOWN_MAX; i++) r.ids.delete(oldest[i][0]);
  }
  if (shownStore.size > STORE_MAX) pruneStore();
}

// Fisher-Yates: orden aleatorio sin sesgo.
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Selecciona hasta `count` pistas del pool evitando las ya mostradas a esta
// sesión. opts.order = "keep" conserva el orden del pool (secciones tipo
// ranking como Tendencias); por defecto mezcla (radios).
// En secciones "keep", la PRIMERA visita de cada sesión arranca en un punto
// aleatorio del pool (ventana corrida): no todo el mundo ve el mismo top a la
// vez y la siguiente visita sigue hacia delante sin repetir.
export function pickFresh(
  scope: string,
  pool: Track[],
  count: number,
  opts?: { order?: "keep" | "shuffle" }
): Track[] {
  if (pool.length === 0 || count <= 0) return [];
  const keep = opts?.order === "keep";
  const source = keep ? pool : shuffle(pool);
  const r = shownStore.get(scope);
  const now = Date.now();
  const shownIds = r?.ids;
  const isFresh = (id: string) => {
    const ts = shownIds?.get(id);
    return ts === undefined || now - ts > SHOWN_TTL;
  };
  const fresh = source.filter((t) => isFresh(t.id));
  let pick: Track[];
  if (keep && r === undefined) {
    // Primera visita (o ciclo recién reiniciado): ventana con inicio aleatorio.
    const maxStart = Math.max(0, fresh.length - count);
    const start = Math.floor(Math.random() * (maxStart + 1));
    pick = fresh.slice(start, start + count);
  } else {
    pick = fresh.slice(0, count);
  }
  if (pick.length < count) {
    // Pool agotado para esta sesión: olvida lo mostrado y completa con
    // canciones ya vistas (nuevo ciclo, en otro orden si se mezcla).
    shownStore.delete(scope);
    const rest = source.filter((t) => !pick.some((p) => p.id === t.id));
    pick.push(...rest.slice(0, count - pick.length));
  }
  markShown(scope, pick);
  return pick;
}
