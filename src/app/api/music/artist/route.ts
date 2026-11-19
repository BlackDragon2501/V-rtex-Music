import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/music/cache";
import { audiusArtistDetail } from "@/lib/music/audius";
import { ccmixterArtistDetail } from "@/lib/music/ccmixter";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  try {
    // Artistas de Audius: ids con prefijo "au-" (música completa y libre).
    if (id.startsWith("au-")) {
      const userId = id.slice(3);
      if (!userId) return NextResponse.json({ error: "id inválido" }, { status: 400 });
      const detail = await cached(`artist-au:${userId}`, 60 * 60_000, () => audiusArtistDetail(userId));
      if (!detail) return NextResponse.json({ error: "Artista no encontrado" }, { status: 404 });
      return NextResponse.json(detail, { headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=300" } });
    }

    // Artistas de ccMixter: ids con prefijo "cc-" + nombre de usuario (URL-encoded).
    if (id.startsWith("cc-")) {
      const userName = id.slice(3);
      if (!userName) return NextResponse.json({ error: "id inválido" }, { status: 400 });
      const detail = await cached(`artist-cc:${userName.toLowerCase()}`, 60 * 60_000, () =>
        ccmixterArtistDetail(userName)
      );
      if (!detail) return NextResponse.json({ error: "Artista no encontrado" }, { status: 404 });
      return NextResponse.json(detail, { headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=300" } });
    }

    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "No se pudo cargar el artista" }, { status: 502 });
  }
}
