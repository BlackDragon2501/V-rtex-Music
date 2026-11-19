import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/music/cache";
import { audiusSearchTracks, audiusSearchUsers } from "@/lib/music/audius";
import { openverseSearch } from "@/lib/music/openverse";
import { ccmixterSearch } from "@/lib/music/ccmixter";
import { wikimediaSearch } from "@/lib/music/wikimedia";
import { jamendoSearch } from "@/lib/music/jamendo";
import { archiveSearch, archiveReachable } from "@/lib/music/archive";
import { maybeRotateDaily } from "@/lib/music/scheduler";
import type { SearchPayload, Track } from "@/lib/music/types";

export const dynamic = "force-dynamic";

// Escrituras no latinas: cirílico (ruso) y CJK (chino/japonés). En esas
// consultas solo Wikimedia/Openverse/Jamendo buscan con precisión.
const MULTILINGUAL = /[\u0400-\u04FF]|[\u4E00-\u9FFF]|[\u3040-\u30FF]/;

// Búsqueda 100% legal: todas las fuentes devuelven audio COMPLETO (sin avances).
// · Audius      → red de streaming de artistas independientes (canciones completas)
// · Openverse   → Jamendo y Wikimedia (Creative Commons, completas)
// · ccMixter    → comunidad de remixes/música original (CC, completas)
// · Wikimedia   → Commons: grabaciones de dominio público (completas)
// · Jamendo     → catálogo directo de 640.000+ canciones CC (con client_id
//                 gratuito en .env; sin él, cae a Openverse filtrado a Jamendo)
// · Internet Archive → netlabels CC y discos históricos de libre distribución
export async function GET(req: NextRequest) {
  // Cron de rotación diaria: al cambiar el día se limpia también la caché de
  // búsquedas (ver src/lib/music/scheduler.ts). Coste: 1 comparación.
  maybeRotateDaily();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ songs: [], artists: [] } satisfies SearchPayload);
  }

  const key = `search:v5:${q.toLowerCase()}`;
  // Si una fuente volvió vacía (timeout en el arranque en frío, pico de red…)
  // el payload NO se cachea: el siguiente intento la recupera. Recalcular es
  // barato porque cada fuente guarda lo suyo en su propia caché.
  let sourceMissing = true;
  const payload = await cached<SearchPayload>(
    key,
    5 * 60_000,
    async () => {
      const isMultilingual = MULTILINGUAL.test(q);
      const [audiusSongs, openverseSongs, ccmSongs, wmSongs, jmSongs, iaSongs, artists] = await Promise.allSettled([
        audiusSearchTracks(q, 20),
        openverseSearch(q, 20),
        // ccMixter no maneja cirílico/CJK: se evita la consulta (ruido puro).
        isMultilingual ? Promise.resolve([]) : ccmixterSearch(q, 20),
        wikimediaSearch(q, 15),
        jamendoSearch(q, 20),
        // Internet Archive tampoco aporta en cirílico/CJK (metadatos latinos).
        // limit=24: un disco completo de la búsqueda debe caber entero.
        isMultilingual ? Promise.resolve([]) : archiveSearch(q, 24),
        audiusSearchUsers(q, 10),
      ]);
      const au = audiusSongs.status === "fulfilled" ? audiusSongs.value : [];
      const ov = openverseSongs.status === "fulfilled" ? openverseSongs.value : [];
      const ccm = ccmSongs.status === "fulfilled" ? ccmSongs.value : [];
      const wm = wmSongs.status === "fulfilled" ? wmSongs.value : [];
      const jm = jmSongs.status === "fulfilled" ? jmSongs.value : [];
      const ia = iaSongs.status === "fulfilled" ? iaSongs.value : [];

      // Fuente esperada vacía (un rechazo también llega como []) → recalcular.
      sourceMissing =
        au.length === 0 ||
        ov.length === 0 ||
        (!isMultilingual && ccm.length === 0) ||
        wm.length === 0 ||
        jm.length === 0 ||
        // Internet Archive es OPCIONAL: solo se exige cuando es alcanzable.
        (!isMultilingual && archiveReachable() && ia.length === 0);

      // En consultas cirílicas/CJK, Wikimedia y Openverse son las únicas fuentes
      // que buscan bien en esos alfabetos: primero sus resultados.
      const pool = isMultilingual
        ? [...wm, ...ov, ...jm, ...au, ...ccm]
        : [...au, ...jm, ...ov, ...ia, ...ccm, ...wm];
      // Sin duplicados por título+artista entre fuentes.
      const seen = new Set<string>();
      const songs: Track[] = pool.filter((t) => {
        const k = `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return {
        songs,
        artists: artists.status === "fulfilled" ? artists.value : [],
      };
    },
    () => !sourceMissing
  );

  return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=300" } });
}
