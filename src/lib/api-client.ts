import type { ArtistDetail, GenreDetail, HomePayload, SearchPayload } from "./music/types";

// Identidad de SESIÓN (sessionStorage): el servidor la usa para no repetir
// canciones de Tendencias y Radios dentro de la misma sesión del usuario.
function sessionId(): string {
  if (typeof window === "undefined") return "anon";
  try {
    let sid = sessionStorage.getItem("vortex_sid");
    if (!sid) {
      sid = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem("vortex_sid", sid);
    }
    return sid;
  } catch {
    return "anon";
  }
}

// Contador de visitas: cada montaje de una vista pide una tanda NUEVA. Al
// entrar en la clave de React Query rompe su caché local (staleTime) para que
// la rotación del servidor se note en cada entrada a la vista.
let visitSeq = 0;
export function nextVisit(): number {
  visitSeq += 1;
  return visitSeq;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignorar */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const api = {
  home: () => getJson<HomePayload>(`/api/music/home?sid=${sessionId()}`),
  search: (q: string) => getJson<SearchPayload>(`/api/music/search?q=${encodeURIComponent(q)}`),
  artist: (id: string) => getJson<ArtistDetail>(`/api/music/artist?id=${encodeURIComponent(id)}`),
  genre: (slug: string, exclude?: string) =>
    getJson<GenreDetail & { label: string }>(
      `/api/music/genre?slug=${encodeURIComponent(slug)}&sid=${sessionId()}` +
        // exclude = ids ya visibles: el botón "Más canciones" pide otra tanda
        // al momento sin repetir ninguna pista en pantalla.
        (exclude ? `&exclude=${encodeURIComponent(exclude)}` : "")
    ),
};

// Precarga "fire-and-forget" al pasar el cursor: las respuestas quedan en la
// caché HTTP (max-age) y la vista se abre al instante al hacer clic.
function prewarm(url: string): void {
  if (typeof window === "undefined") return;
  try {
    fetch(url, { priority: "low" }).catch(() => undefined);
  } catch {
    /* ignorar */
  }
}

export const prefetch = {
  // Los artistas de IA (id "ia-…") se cargan client-side desde archive.org:
  // pedir su endpoint de servidor daría 400 y no hay nada que precalentar.
  artist: (id: string) => {
    if (id.startsWith("ia-")) return;
    prewarm(`/api/music/artist?id=${encodeURIComponent(id)}`);
  },
};

export function artistTopSongs(id: string) {
  return api.artist(id).then((d) => d.topSongs);
}
