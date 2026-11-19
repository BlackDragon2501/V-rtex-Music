import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/music/cache";
import { audiusResolve } from "@/lib/music/audius";
import { openverseResolve } from "@/lib/music/openverse";
import { ccmixterResolve } from "@/lib/music/ccmixter";
import { wikimediaResolve } from "@/lib/music/wikimedia";
import { jamendoResolve } from "@/lib/music/jamendo";
import { archiveResolve } from "@/lib/music/archive";
import type { Track } from "@/lib/music/types";

export const dynamic = "force-dynamic";

// Resolución de versión COMPLETA en catálogos libres: Audius, Openverse
// (Jamendo, Wikimedia), ccMixter directo, Wikimedia Commons, Jamendo directo
// e Internet Archive.
// El reproductor intercambia la fuente en caliente si encuentra la canción.
export async function GET(req: NextRequest) {
  const title = (req.nextUrl.searchParams.get("t") ?? "").trim();
  const artist = (req.nextUrl.searchParams.get("a") ?? "").trim();
  const dur = Number(req.nextUrl.searchParams.get("d") ?? "0");

  if (!title || !artist) {
    return NextResponse.json({ resolved: false, reason: "missing-params" }, { status: 400 });
  }

  const key = `resolve:v5:${title.toLowerCase()}|${artist.toLowerCase()}|${Math.round(dur)}`;
  const result = await cached<{ resolved: boolean; track: Track | null }>(key, 6 * 60 * 60_000, async () => {
    // Los cinco catálogos libres en paralelo.
    const [au, ov, ccm, wm, jm, ia] = await Promise.allSettled([
      audiusResolve(title, artist, dur),
      openverseResolve(title, artist, dur),
      ccmixterResolve(title, artist, dur),
      wikimediaResolve(title, artist, dur),
      jamendoResolve(title, artist, dur),
      archiveResolve(title, artist, dur),
    ]);
    const hits = [au, ov, ccm, wm, jm, ia].map((r) => (r.status === "fulfilled" ? r.value : null));
    // Preferimos la coincidencia con duración más cercana al catálogo original.
    let best: Track | null = null;
    for (const hit of hits) {
      if (!hit) continue;
      if (
        !best ||
        (dur > 0 && Math.abs(hit.duration - dur) < Math.abs(best.duration - dur))
      ) {
        best = hit;
      }
    }
    return { resolved: Boolean(best), track: best };
  });

  return NextResponse.json(
    {
      resolved: result.resolved,
      track: result.track
        ? {
            streamUrl: result.track.streamUrl,
            duration: result.track.duration,
            source: result.track.source,
            origin: result.track.origin ?? null,
          }
        : null,
    },
    { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=1800" } }
  );
}
