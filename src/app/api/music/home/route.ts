import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/music/cache";
import { audiusTrending, audiusUnderground } from "@/lib/music/audius";
import { openverseHome } from "@/lib/music/openverse";
import { ccmixterFeatured } from "@/lib/music/ccmixter";
import { wikimediaLanguage } from "@/lib/music/wikimedia";
import { jamendoHome, jamendoWorld } from "@/lib/music/jamendo";
import { archiveHome } from "@/lib/music/archive";
import { pickFresh, poolBucket, rotatedLoad } from "@/lib/music/rotation";
import { maybeRotateDaily } from "@/lib/music/scheduler";
import { junkTitle } from "@/lib/music/match";
import type { HomePayload, Track } from "@/lib/music/types";

export const dynamic = "force-dynamic";

// Portada 100% legal, con audio COMPLETO en todas las secciones:
// · Tendencias y Underground → Audius (artistas independientes, canciones completas)
// · Sonidos libres → Openverse (Jamendo, Wikimedia · Creative Commons) +
//   Jamendo directo + lo más descargado de Internet Archive (colecciones libres)
// · Novedades libres → selección destacada de ccMixter (remixes y original, completas)
// · Rincón del mundo → Rusia, China y Japón tradicionales: Wikimedia Commons
//   (dominio público verificado) + canciones CC de Jamendo
//
// ROTACIÓN DE PORTADA (canciones distintas cada vez):
//  · POOL por generación (15 min): cada sección se construye con offset
//    aleatorio en las APIs (páginas distintas cada generación) y se cachea un
//    pool 2-3× más grande que lo mostrado.
//  · SESIÓN: en cada visita pickFresh() reparte del pool canciones aún no
//    vistas por esta sesión (sid); secciones tipo ranking conservan su orden
//    (ventanas corridas) y las mixtas salen mezcladas.
const POOL = { trending: 60, underground: 36, fresh: 40, cc: 40, wmRu: 30, wmCn: 18, wmJp: 18, ia: 18 };
const SHOW = { trending: 24, underground: 16, fresh: 20, cc: 24, world: 16 };

export async function GET(req: NextRequest) {
  // Cron de rotación diaria: si cambió el día (America/Managua), el pool de
  // portada se reconstruye antes de servir esta visita (ver scheduler.ts).
  maybeRotateDaily();
  // sid = identidad de sesión (sessionStorage del cliente); "anon" si falta.
  const sid = req.nextUrl.searchParams.get("sid") || "anon";

  let sourceMissing = true;
  const pool = await cached<HomePayload>(
    `home:pool:v6:${poolBucket()}`,
    16 * 60_000,
    async () => {
      const [trending, underground, fresh, ccOv, wmRu, wmCn, wmJp, jmRu, jmCn, jmJp, jmHome, iaHome] = await Promise.allSettled([
        rotatedLoad(5, (s) => audiusTrending(POOL.trending, s * 30), 30),
        rotatedLoad(4, (s) => audiusUnderground(POOL.underground, s * 24), 16),
        rotatedLoad(3, (s) => ccmixterFeatured(POOL.fresh, s * 20), 12),
        openverseHome(POOL.cc), // páginas aleatorias dentro (ver openverseHome)
        rotatedLoad(3, (s) => wikimediaLanguage("ru", POOL.wmRu, s * 12), 8),
        rotatedLoad(3, (s) => wikimediaLanguage("cn", POOL.wmCn, s * 12), 2),
        rotatedLoad(3, (s) => wikimediaLanguage("jp", POOL.wmJp, s * 12), 4),
        rotatedLoad(3, (s) => jamendoWorld("ru", 12, s * 12), 4),
        rotatedLoad(3, (s) => jamendoWorld("cn", 12, s * 12), 4),
        rotatedLoad(3, (s) => jamendoWorld("jp", 12, s * 12), 4),
        rotatedLoad(4, (s) => safeJamendoHome(POOL.cc / 2, s * 24), 8),
        rotatedLoad(3, (s) => archiveHome(POOL.ia, s + 1), 6),
      ]);
      // Diagnóstico: las fuentes rechazadas quedan ciegas en allSettled.
      for (const [label, r] of [
        ["audiusTrending", trending], ["audiusUnder", underground], ["ccmFeatured", fresh],
        ["openverseHome", ccOv], ["wmRu", wmRu], ["wmCn", wmCn], ["wmJp", wmJp],
        ["jmRu", jmRu], ["jmCn", jmCn], ["jmJp", jmJp], ["jmHome", jmHome], ["iaHome", iaHome],
      ] as const) {
        if (r.status === "rejected") {
          console.error(`[home] fuente ${label} rechazada:`, r.reason instanceof Error ? r.reason.message : r.reason);
        }
      }

      const auT = trending.status === "fulfilled" ? trending.value : [];
      const auU = underground.status === "fulfilled" ? underground.value : [];
      const ccmF = fresh.status === "fulfilled" ? fresh.value : [];
      const ovH = ccOv.status === "fulfilled" ? ccOv.value : [];
      const ruW = wmRu.status === "fulfilled" ? wmRu.value : [];
      const cnW = wmCn.status === "fulfilled" ? wmCn.value : [];
      const jpW = wmJp.status === "fulfilled" ? wmJp.value : [];
      const ruJ = jmRu.status === "fulfilled" ? jmRu.value : [];
      const cnJ = jmCn.status === "fulfilled" ? jmCn.value : [];
      const jpJ = jmJp.status === "fulfilled" ? jmJp.value : [];
      const jmH = jmHome.status === "fulfilled" ? jmHome.value : [];
      const iaH = iaHome.status === "fulfilled" ? iaHome.value : [];

      // Sección mundo: INTERCALADO Rusia/China/Japón (Wikimedia primero,
      // Jamendo después, un turno por bloque): cualquier ventana de la sección
      // muestra los tres países en vez de quedarse solo con el más poblado.
      const world: Track[] = [];
      const seen = new Set<string>();
      const queues = [ruW, cnW, jpW, ruJ, cnJ, jpJ].map((r) => [...r]);
      for (let i = 0; world.length < 90 && queues.some((q) => q.length > 0); i++) {
        const t = queues[i % queues.length].shift();
        if (!t || junkTitle(t.title)) continue;
        const k = `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;
        if (seen.has(k)) continue;
        seen.add(k);
        world.push(t);
      }

      // "Sonidos libres": Openverse + Jamendo directo + Internet Archive.
      const cc: Track[] = [];
      const seenCc = new Set<string>();
      for (const t of [...ovH, ...jmH, ...iaH]) {
        if (junkTitle(t.title)) continue;
        const k = `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;
        if (seenCc.has(k)) continue;
        seenCc.add(k);
        cc.push(t);
      }

      // El pool solo se cachea si las CINCO secciones quedaron pobladas: un
      // fallo transitorio de una fuente no congela una portada coja durante
      // todo el TTL (igual que el guardián por fuentes de las radios).
      sourceMissing = auT.length === 0 || auU.length === 0 || ccmF.length === 0 || cc.length === 0 || world.length === 0;

      return {
        trending: auT,
        underground: auU,
        fresh: ccmF,
        ccTracks: cc,
        world,
      };
    },
    () => !sourceMissing
  );

  // Selección de ESTA visita por sección (registro anti-repetición por sesión):
  // rankings con ventana corrida ("keep") y pools mixtos mezclados.
  const payload: HomePayload = {
    trending: pickFresh(`home:trending:${sid}`, pool.trending, SHOW.trending, { order: "keep" }),
    underground: pickFresh(`home:underground:${sid}`, pool.underground, SHOW.underground, { order: "keep" }),
    fresh: pickFresh(`home:fresh:${sid}`, pool.fresh, SHOW.fresh, { order: "keep" }),
    ccTracks: pickFresh(`home:cc:${sid}`, pool.ccTracks, SHOW.cc),
    world: pickFresh(`home:world:${sid}`, pool.world, SHOW.world, { order: "keep" }),
  };

  // no-store: cada visita debe llegar al servidor para rotar la selección
  // (el coste es mínimo: el pool ya está cacheado en memoria).
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}

// Jamendo directo en portada: vacío si aún no hay client_id (Openverse ya
// aporta el catálogo de Jamendo en la misma sección). Con offset para la
// rotación de la sección "Sonidos libres".
async function safeJamendoHome(limit: number, offset = 0): Promise<Track[]> {
  try {
    const { jamendoConfigured } = await import("@/lib/music/jamendo");
    if (!jamendoConfigured()) return [];
    return await jamendoHome(limit, offset);
  } catch {
    return [];
  }
}
