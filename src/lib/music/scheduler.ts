// ============ Cron de rotación diaria del catálogo ==========================
//
// Qué hace: al cambiar el día (zona horaria America/Managua, la del público
// de Vórtex) el programador:
//   1. Vacía la caché de música (pools de portada, radios, búsquedas,
//      metadatos de IA) → todo se reconstruye con offsets ALEATORIOS nuevos.
//   2. Reinicia la memoria anti-repetición de las sesiones → cada jornada
//      arranca un ciclo limpio aunque el servidor lleve días encendido.
//   3. Precalienta la portada y unas radios representativas → la primera
//      visita del día encuentra el pool listo (respuesta instantánea).
//
// Doble mecanismo (por si uno falla, el otro garantiza la rotación):
//   a) CRON ACTIVO: src/instrumentation.ts → register() arranca un intervalo
//      que comprueba el cambio de día cada minuto (ideal en producción,
//      `next start`).
//   b) ROTACIÓN BAJO DEMANDA: las rutas API (home/genre/search) llaman a
//      maybeRotateDaily() al entrar. Si el intervalo muriera (HMR de dev,
//      contexto drenado), la PRIMERA petición del día nuevo rota el catálogo
//      igualmente, de forma síncrona y barata (comparar 1 string).
//
// Seguridad: idempotente (guardián en globalThis, sobrevive al HMR de dev),
// todo el trabajo pesado es fire-and-forget con catch → un fallo de red del
// precalentamiento no tumba ni ensucia el servidor.

import { clearMusicCaches } from "./cache";
import { resetRotationMemory } from "./rotation";

// Zona horaria de la organización (los "días" de Vórtex cambian a medianoche
// de Managua, UTC-6, no a medianoche UTC).
const TZ = "America/Managua";

// Radios que se precalientan tras la rotación (slugs de genres.ts) además de
// la portada: cubren los géneros más visitados sin saturar las APIs externas.
// j-pop representa a la familia japonesa (las otras tres comparten fuentes).
const PREWARM_GENRES = ["rock", "metal", "electronic", "hip-hop", "j-pop"];

// Clave del día actual en America/Managua ("2026-11-19").
function dayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Precalienta portada + radios con peticiones HTTP locales (ejercen el camino
// real: rutas → caché → fuentes). Nunca lanza: fallo = solo un log.
async function prewarm(): Promise<void> {
  try {
    const port = process.env.PORT || "3000";
    const base = `http://127.0.0.1:${port}`;
    const targets = ["/api/music/home", ...PREWARM_GENRES.map((s) => `/api/music/genre?slug=${s}`)];
    const results = await Promise.allSettled(
      targets.map((t) =>
        fetch(`${base}${t}`, { signal: AbortSignal.timeout(90_000), cache: "no-store" })
      )
    );
    const ok = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
    console.log(`[cron] Precalentamiento: ${ok}/${targets.length} fuentes listas (portada + ${PREWARM_GENRES.length} radios).`);
  } catch (e) {
    console.error("[cron] Error al precalentar:", e);
  }
}

// Comprobación de cambio de día: barata (1 comparación de strings) y segura
// de llamar en CADA petición. Al detectar un día nuevo vacía cachés y memoria
// de rotación DE FORMA SÍNCRONA (así la respuesta que la llamó ya nace
// renovada) y deja el precalentamiento en segundo plano.
export function maybeRotateDaily(): void {
  const g = globalThis as unknown as { __vortexLastDay?: string };
  const now = dayKey();
  if (g.__vortexLastDay === now) return; // mismo día: nada que hacer
  const hadPrevious = typeof g.__vortexLastDay === "string";
  g.__vortexLastDay = now;
  if (!hadPrevious) return; // arranque/reciclado de módulo: no rotar nada
  try {
    const caches = clearMusicCaches();
    const sessions = resetRotationMemory();
    console.log(
      `[cron] Rotación diaria ${now}: caché de música vaciada (${caches} entradas), memoria anti-repetición reiniciada (${sessions} sesiones). Catálogo renovado.`
    );
  } catch (e) {
    console.error("[cron] Error al rotar el catálogo:", e);
  }
  void prewarm();
}

// Arranque del cron activo (idempotente: un solo intervalo por proceso).
export function startDailyRotation(): void {
  const g = globalThis as unknown as { __vortexRotationCron?: boolean; __vortexLastDay?: string };
  if (g.__vortexRotationCron) return;
  g.__vortexRotationCron = true;
  g.__vortexLastDay = dayKey(); // el día de arranque no cuenta como "cambio"

  console.log(`[cron] Rotación diaria programada · zona ${TZ} · día actual ${g.__vortexLastDay}`);

  // Precalentamiento de arranque: si el proceso acaba de levantarse (deploy,
  // reinicio), deja la portada caliente para la primera visita.
  setTimeout(() => void prewarm(), 15_000);

  // Comprobación de cambio de día cada minuto (coste despreciable).
  const timer = setInterval(maybeRotateDaily, 60_000);
  // No debe mantener el proceso vivo solo por existir.
  timer.unref?.();
}
