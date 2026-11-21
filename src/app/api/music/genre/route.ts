import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/music/cache";
import { audiusByGenre, audiusJapan } from "@/lib/music/audius";
import { openverseByQuery } from "@/lib/music/openverse";
import { ccmixterByTag } from "@/lib/music/ccmixter";
import { wikimediaLanguage, wikimediaSearch } from "@/lib/music/wikimedia";
import { jamendoByQuery, jamendoByTag } from "@/lib/music/jamendo";
import { archiveByQuery, archiveReachable } from "@/lib/music/archive";
import { GENRES } from "@/lib/music/genres";
import { FOREIGN_SCRIPT, JP_SCRIPT, junkTitle } from "@/lib/music/match";
import { pickFresh, poolBucket, rotatedLoad } from "@/lib/music/rotation";
import { maybeRotateDaily } from "@/lib/music/scheduler";
import type { GenreDetail, Track } from "@/lib/music/types";

export const dynamic = "force-dynamic";

// Radio por género con audio COMPLETO y legal: Audius (género nativo),
// Openverse (Jamendo/Wikimedia), ccMixter directo (etiqueta), Wikimedia
// Commons (búsqueda o consultas dedicadas por idioma), Jamendo directo e
// Internet Archive (netlabels CC y discos históricos de libre distribución).
//
// ROTACIÓN DE RADIO (canciones distintas cada vez):
//  · POOL: cada "generación" (15 min, poolBucket) se pide a cada fuente una
//    página distinta (offset aleatorio) y se cachea un pool 2-3× más grande
//    que la lista mostrada. Las claves llevan el bucket, así el acervo de la
//    radio se renueva a lo largo del día sin desbordar cuotas de las APIs.
//  · SESIÓN: en cada visita pickFresh() elige del pool las canciones aún no
//    vistas por esta sesión (sid) y las registra; si el pool se agota, el
//    ciclo reinicia mezclado.
const POOL = { au: 48, ov: 18, ccm: 24, wm: 30, jam: 24, ia: 24 };
const SHOW = 24; // canciones servidas por visita

export async function GET(req: NextRequest) {
  // Cron de rotación diaria: si cambió el día (America/Managua), el catálogo
  // se renueva antes de servir esta radio (ver src/lib/music/scheduler.ts).
  maybeRotateDaily();
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  // sid = identidad de sesión (sessionStorage del cliente); "anon" si falta.
  const sid = req.nextUrl.searchParams.get("sid") || "anon";
  // Ids que el cliente ya tiene en pantalla (botón "Más canciones"): la tanda
  // nueva no debe repetir NINGUNA pista visible, aunque el pool de la sesión
  // ya se haya mostrado entero (el ciclo reinicia y aquí se filtra lo visto).
  const exclude = new Set(
    (req.nextUrl.searchParams.get("exclude") ?? "")
      .split(",")
      .filter(Boolean)
      .slice(0, 200)
  );
  const genre = GENRES[slug];
  if (!genre) return NextResponse.json({ error: "Género desconocido" }, { status: 400 });

  // Capturas const para poder usarlas dentro de las closures de rotación.
  const auGenre = genre.audius;
  const auJp = genre.auJapan === true;
  const ccQuery = genre.cc;
  const ccmTag = genre.ccm;
  const wikiLang = genre.wikiLang;
  const wikiQuery = genre.wiki;
  const jamQuery = genre.jam;
  const jamTag = genre.jamTag;
  const iaQuery = genre.ia;

  // Si alguna fuente configurada falló o volvió vacía (p. ej. timeout en el
  // arranque en frío), el pool NO se cachea: el siguiente visitante vuelve
  // a consultarlo y la radio se completa sola. Recalcular es barato porque
  // cada fuente guarda su resultado en su propia caché.
  let sourceMissing = true;
  const pool = await cached<GenreDetail>(
    `genre:pool:v6:${slug}:${poolBucket()}`,
    16 * 60_000,
    async () => {
      const [audiusTracks, openverseTracks, ccmTracks, wikiTracks, jamTracks, iaTracks, jamTagTracks, auJpTracks] = await Promise.allSettled([
        auGenre ? rotatedLoad(4, (s) => audiusByGenre(auGenre, POOL.au, s * 24), 20) : Promise.resolve([]),
        ccQuery ? rotatedLoad(3, (s) => openverseByQuery(ccQuery, POOL.ov, s + 1), 6) : Promise.resolve([]),
        ccmTag ? rotatedLoad(3, (s) => ccmixterByTag(ccmTag, POOL.ccm, s * 12), 10) : Promise.resolve([]),
        wikiLang
          ? rotatedLoad(3, (s) => wikimediaLanguage(wikiLang, POOL.wm, s * 12), 8)
          : wikiQuery
            ? rotatedLoad(3, (s) => wikimediaSearch(wikiQuery, POOL.wm, s * POOL.wm), 8)
            : Promise.resolve([]),
        jamQuery ? rotatedLoad(4, (s) => jamendoByQuery(jamQuery, POOL.jam, s * 24), 8) : Promise.resolve([]),
        iaQuery ? rotatedLoad(3, (s) => archiveByQuery(iaQuery, POOL.ia, s + 1), 8) : Promise.resolve([]),
        // Japón (Fase 2): tag nativo de Jamendo + Audius filtrado por guion japonés.
        jamTag ? rotatedLoad(4, (s) => jamendoByTag(jamTag, POOL.jam, s * 24), 8) : Promise.resolve([]),
        auJp ? rotatedLoad(4, (s) => audiusJapan(POOL.au, s * 10), 10) : Promise.resolve([]),
      ]);
      // Diagnóstico: las fuentes rechazadas quedan ciegas en allSettled.
      for (const [label, r] of [
        ["audius", audiusTracks], ["openverse", openverseTracks], ["ccmixter", ccmTracks],
        ["wikimedia", wikiTracks], ["jamendo", jamTracks], ["archive", iaTracks],
        ["jamendoTag", jamTagTracks], ["audiusJp", auJpTracks],
      ] as const) {
        if (r.status === "rejected") {
          console.error(`[genre:${slug}] fuente ${label} rechazada:`, r.reason instanceof Error ? r.reason.message : r.reason);
        }
      }
      const au = audiusTracks.status === "fulfilled" ? audiusTracks.value : [];
      const ov = openverseTracks.status === "fulfilled" ? openverseTracks.value : [];
      const ccm = ccmTracks.status === "fulfilled" ? ccmTracks.value : [];
      const wm = wikiTracks.status === "fulfilled" ? wikiTracks.value : [];
      const jm = [
        ...(jamTracks.status === "fulfilled" ? jamTracks.value : []),
        ...(jamTagTracks.status === "fulfilled" ? jamTagTracks.value : []),
      ];
      const ia = iaTracks.status === "fulfilled" ? iaTracks.value : [];
      const auJ = auJpTracks.status === "fulfilled" ? auJpTracks.value : [];

      // Japón: dentro de Jamendo el tag lo pone el propio uploader y hay
      // artistas no japoneses auto-etiquetados (verificado en el sondeo).
      // Los títulos con guion japonés (kana/kanji) forman el núcleo del pool
      // y el material solo-etiquetado queda LIMITADO a 4 por generación: la
      // radio se SIENTE japonesa incluso tras el mezclado de pickFresh.
      if (wikiLang === "jp") {
        const isJp = (t: Track) => JP_SCRIPT.test(`${t.title}${t.artist}`);
        const cjkJm = jm.filter(isJp);
        const rest = jm.filter((t) => !isJp(t)).slice(0, 4);
        jm.length = 0;
        jm.push(...cjkJm, ...rest);
      }

      // Configurada pero vacía (rechazada también llega como []) → recalcular.
      // Audius de Japón también es OPCIONAL: su búsqueda CJK puede volver sin
      // resultados genuinos en una generación; no debe invalidar el pool.
      sourceMissing =
        (!!auGenre && au.length === 0) ||
        (!!ccQuery && ov.length === 0) ||
        (!!ccmTag && ccm.length === 0) ||
        ((!!wikiLang || !!wikiQuery) && wm.length === 0) ||
        ((!!jamQuery || !!jamTag) && jm.length === 0) ||
        // Internet Archive es OPCIONAL: si el entorno no puede alcanzarla
        // (anti-abuso de IA contra IPs de datacenter) la radio se cachea igual
        // que sin ella; cuando IA responde, pasa a exigirse como las demás.
        (!!iaQuery && archiveReachable() && ia.length === 0);

      // Sin duplicados por título+artista entre fuentes. Wikimedia primero en las
      // radios por idioma (contenido verificado), después Jamendo y el resto.
      // Se descartan además los títulos en alfabetos ajenos al género (ruido de
      // metadatos de Openverse/Jamendo; cirílico y CJK no están afectados).
      const ordered = wikiLang
        ? [...wm, ...jm, ...ov, ...ia, ...ccm, ...au, ...auJ]
        : [...au, ...auJ, ...jm, ...ov, ...ia, ...ccm, ...wm];
      const seen = new Set<string>();
      const tracks: Track[] = ordered.filter((t) => {
        if (FOREIGN_SCRIPT.test(t.title) || junkTitle(t.title)) return false;
        const k = `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return { label: genre.label, tracks };
    },
    () => !sourceMissing
  );

  // Tanda de ESTA visita: se evitan las canciones ya mostradas a esta sesión
  // (registro en memoria) y las que el cliente ya tiene en pantalla (exclude);
  // pool agotado → nuevo ciclo mezclado (el cliente filtra lo visible, así la
  // pantalla siempre recibe material distinto mientras el pool tenga algo).
  const candidates =
    exclude.size > 0 ? pool.tracks.filter((t) => !exclude.has(t.id)) : pool.tracks;
  const tracks = pickFresh(`radio:${slug}:${sid}`, candidates, SHOW);

  return NextResponse.json(
    { label: pool.label, tracks },
    // no-store: cada visita debe llegar al servidor para rotar la selección
    // (el coste es mínimo: el pool ya está cacheado en memoria).
    { headers: { "Cache-Control": "no-store" } }
  );
}
