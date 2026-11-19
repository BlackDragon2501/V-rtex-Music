import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Proxy de streaming para el audio de ccMixter.
// ccMixter solo sirve sus MP3 cuando la petición lleva Referer de ccmixter.org,
// así que el navegador no puede pedirlos directamente. Este proxy añade la
// cabecera, reenvía el Range del cliente (para que la barra de progreso permita
// adelantar/retroceder) y transmite el audio en streaming.

const PATH_RE = /^\/content\/[\w.\-%]+\/[\w.\-%]+\.(mp3|ogg|oga|flac|wav)$/i;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("p") ?? "";
  let path = "";
  try {
    path = decodeURIComponent(raw);
  } catch {
    return NextResponse.json({ error: "ruta inválida" }, { status: 400 });
  }
  if (!path || path.includes("..") || !PATH_RE.test(path)) {
    return NextResponse.json({ error: "ruta no permitida" }, { status: 400 });
  }

  const range = req.headers.get("range") ?? "";
  try {
    const upstream = await fetch(`https://ccmixter.org${path}`, {
      headers: {
        Referer: "https://ccmixter.org/",
        "User-Agent": "VortexMusic/1.0 (web player)",
        ...(range ? { Range: range } : {}),
      },
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: "audio no disponible" }, { status: 502 });
    }
    const headers = new Headers();
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (!headers.has("content-type")) headers.set("content-type", "audio/mpeg");
    headers.set("accept-ranges", "bytes");
    headers.set("cache-control", "public, max-age=86400");
    return new Response(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
  } catch {
    return NextResponse.json({ error: "no se pudo obtener el audio" }, { status: 502 });
  }
}
