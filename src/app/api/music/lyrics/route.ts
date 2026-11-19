import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/music/cache";
import { fetchLyrics, type LyricsPayload } from "@/lib/music/lyrics";

export const dynamic = "force-dynamic";

// Letras sincronizadas (LRCLIB): marcas de tiempo por línea para el panel
// de reproducción. Cacheadas 24 h por pista para no abusar del servicio.
const EMPTY: LyricsPayload = { synced: false, lines: [], plain: "", provider: "" };

export async function GET(req: NextRequest) {
  const title = (req.nextUrl.searchParams.get("t") ?? "").trim();
  const artist = (req.nextUrl.searchParams.get("a") ?? "").trim();
  const dur = Number(req.nextUrl.searchParams.get("d") ?? "0");

  if (!title || !artist) {
    return NextResponse.json(EMPTY, { status: 400 });
  }

  const key = `lyrics:v1:${title.toLowerCase()}|${artist.toLowerCase()}|${Math.round(dur)}`;
  const payload = await cached<LyricsPayload>(key, 24 * 60 * 60_000, async () => {
    const res = await fetchLyrics(title, artist, dur);
    return res ?? EMPTY;
  });

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400" },
  });
}
