// Caché en memoria con TTL para respuestas de APIs externas.
import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";

type Entry = { t: number; v: unknown };

const store = new Map<string, Entry>();

// UA por defecto de Vórtex Music para las APIs de fuentes de audio.
const DEFAULT_UA = "VortexMusicApp/1.0 (reproductor web; contacto: vortexmusic.soporte.app@gmail.com)";

export function getCache<T>(key: string): T | undefined {
  const hit = store.get(key);
  return hit ? (hit.v as T) : undefined;
}

export function setCache(key: string, value: unknown): void {
  store.set(key, { t: Date.now(), v: value });
  // Limpieza simple para evitar crecimiento ilimitado.
  if (store.size > 400) {
    const now = Date.now();
    for (const [k, e] of store) {
      if (now - e.t > 30 * 60_000) store.delete(k);
    }
  }
}

// Vacía TODA la caché de música (pools de portada, radios, búsquedas,
// metadatos de IA…). La usa el cron de rotación diaria: al cambiar el día
// todo se reconstruye con offsets nuevos → catálogo renovado cada jornada.
// Devuelve cuántas entradas había para el log del programador.
export function clearMusicCaches(): number {
  const n = store.size;
  store.clear();
  return n;
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  validate?: (value: T) => boolean
): Promise<T> {
  const hit = getCache<T>(key);
  if (hit !== undefined) return hit;
  const value = await loader();
  // No cachear listas VACÍAS ni valores que no superen la validación: una
  // respuesta fallida transitoria (timeout en el arranque en frío, pico de
  // red…) quedaría congelada durante todo el TTL y la vista perdería fuentes
  // durante minutos. El siguiente intento vuelve a consultarlo.
  if (Array.isArray(value) && value.length === 0) return value;
  if (validate && !validate(value)) return value;
  setCache(key, value);
  return value;
}

async function fetchOnce<T>(url: string, timeoutMs: number, ua: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return (await res.json()) as T;
}

export async function fetchJson<T>(url: string, timeoutMs = 15000, ua?: string): Promise<T> {
  // ua === undefined → UA por defecto de la app; ua === "" → NO enviar la
  // cabecera User-Agent (algunas APIs la tratan distinto según el cliente).
  const headers: Record<string, string> | undefined = ua === undefined
    ? { "User-Agent": DEFAULT_UA }
    : ua === ""
      ? undefined
      : { "User-Agent": ua };
  // Un reintento ante fallos de red transitorios (conexiones recicladas, etc.).
  try {
    return await fetchOnce<T>(url, timeoutMs, headers?.["User-Agent"] ?? "", headers);
  } catch (e) {
    if (e instanceof Error && /^HTTP \d+/.test(e.message)) throw e; // error HTTP real: no reintentar
    await new Promise((r) => setTimeout(r, 600));
    return fetchOnce<T>(url, timeoutMs, headers?.["User-Agent"] ?? "", headers);
  }
}

// Descarga JSON con cabeceras de respuesta GRANDES. Algunas APIs (ccMixter)
// duplican la carga útil en una cabecera "X-JSON" que crece con el número de
// pistas: con 24+ ítems supera holgadamente los 128 KB que desbordan el límite
// de undici/llhttp ("Parse Error: Header overflow"). node:https permite
// ampliar maxHeaderSize por petición: 768 KB cubre cualquier respuesta actual.
export function fetchJsonLenient<T>(url: string, timeoutMs = 15000, ua?: string): Promise<T> {
  const agent = ua ?? "VortexMusicApp/1.0 (reproductor web; contacto: vortexmusic.soporte.app@gmail.com)";
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };
    const req = httpsRequest(
      url,
      {
        method: "GET",
        headers: { "User-Agent": agent },
        maxHeaderSize: 786432, // 768 KB
      },
      (res: IncomingMessage) => {
        const status = res.statusCode ?? 500;
        if (status >= 400) {
          res.resume();
          done(() => reject(new Error(`HTTP ${status} en ${url}`)));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          done(() => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as T);
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          });
        });
        res.on("error", (e) => done(() => reject(e)));
      }
    );
    req.on("error", (e) => done(() => reject(e)));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      done(() => reject(new Error(`Tiempo agotado en ${url}`)));
    });
    req.end();
  });
}
