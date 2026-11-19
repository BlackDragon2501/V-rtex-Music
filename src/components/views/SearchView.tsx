"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { api, prefetch } from "@/lib/api-client";
import { iaBrowserBundle, type IaBundle } from "@/lib/music/ia-browser";
import { trackMatchesQuery, artistMatchesQuery } from "@/lib/music/match";
import { useAsync } from "@/hooks/use-async";
import { usePlay } from "@/hooks/use-play";
import { AlbumCard, MediaCard } from "@/components/music/MediaCard";
import { TrackList } from "@/components/music/TrackRow";
import { BackButton } from "@/components/music/BackButton";
import { RecentSearchesPanel } from "@/components/music/RecentSearches";
import { ErrorState, EmptyState, CardsSkeleton, RowsSkeleton } from "@/components/music/ViewHeader";
import { CarouselItem } from "@/components/music/Section";
import { usePlayer } from "@/store/player";
import { useNav } from "@/store/nav";
import { useSearchHistory } from "@/store/search-history";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GENRES } from "@/lib/music/genres";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/music/types";

// Sugerencias con resultados reales en el catálogo legal (audio completo).
const SUGGESTIONS = [
  "Reggaetón",
  "Rock",
  "Pop",
  "Hip-Hop",
  "Trance",
  "Lo-Fi",
  "Jazz",
  "Salsa",
];

const EMPTY_BUNDLE: IaBundle = { tracks: [], albums: [], artists: [] };

export function SearchView({ q: initialQ }: { q?: string }) {
  const [q, setQ] = useState(initialQ ?? "");
  const [tab, setTab] = useState("all");
  const push = useNav((s) => s.push);
  const { playArtistTop } = usePlay();
  const addSearch = useSearchHistory((s) => s.add);

  // Historial de búsqueda en el campo móvil (igual que en la barra superior).
  const [histOpen, setHistOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const closeHistory = (e: PointerEvent) => {
    if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
      setHistOpen(false);
    }
  };
  const toggleHistory = (open: boolean) => {
    if (open) {
      document.addEventListener("pointerdown", closeHistory);
    } else {
      document.removeEventListener("pointerdown", closeHistory);
    }
    setHistOpen(open);
  };

  const { data, loading, error, reload } = useAsync(
    () => (q.trim().length >= 2 ? api.search(q.trim()) : Promise.resolve(null)),
    [q]
  );

  // Internet Archive desde el NAVEGADOR: el anti-abuso de IA bloquea las IPs
  // de datacenter (la del servidor), pero no la del usuario. Una SOLA ola IA
  // trae canciones, álbumes y creadores que coinciden con la búsqueda (p. ej.
  // el disco completo que el propio artista subió). Cualquier fallo → vacío
  // sin afectar al resto de fuentes.
  const [ia, setIa] = useState<IaBundle>(EMPTY_BUNDLE);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaQuery, setIaQuery] = useState("");
  // Reset al cambiar la consulta (patrón de ajuste en render, como externalQ).
  if (q.trim() !== iaQuery) {
    setIaQuery(q.trim());
    setIa(EMPTY_BUNDLE);
    setIaLoading(q.trim().length >= 2);
  }
  useEffect(() => {
    if (iaQuery.length < 2 || !iaLoading) return;
    let alive = true;
    // Pequeño respiro: los resultados del servidor van primero y IA no compite
    // con ellos por ancho de banda del usuario.
    const t = setTimeout(() => {
      iaBrowserBundle(iaQuery, 40)
        .then((bundle) => {
          if (!alive) return;
          setIa(bundle);
          setIaLoading(false);
        })
        .catch(() => {
          if (alive) setIaLoading(false);
        });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [iaQuery, iaLoading]);

  // Artistas combinados: catálogo del servidor (con el mismo filtro estricto
  // que las canciones) + creadores de Internet Archive que coinciden con la
  // búsqueda (sin duplicar por nombre).
  const allArtists = useMemo(() => {
    const base = (data?.artists ?? []).filter((a) => artistMatchesQuery(q.trim(), a.name));
    const seen = new Set(base.map((a) => a.name.toLowerCase()));
    const extra = ia.artists.filter((a) => !seen.has(a.name.toLowerCase()));
    return [...base, ...extra];
  }, [data, ia.artists, q]);

  // Álbumes combinados (hoy: discos de IA; `data.albums` queda listo para
  // futuras fuentes server-side que expongan discos).
  const albums = useMemo(() => {
    const base = data?.albums ?? [];
    const seen = new Set(base.map((a) => a.id));
    return [...base, ...ia.albums.filter((a) => !seen.has(a.id))];
  }, [data, ia.albums]);

  // Lista combinada sin duplicados (por id y por título+artista entre fuentes).
  const allSongs = useMemo(() => {
    const base = data?.songs ?? [];
    const seen = new Set<string>();
    for (const t of base) seen.add(`${t.id}|${t.title.toLowerCase()}|${t.artist.toLowerCase()}`);
    const extra = ia.tracks.filter((t) => {
      const k = `${t.id}|${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return [...base, ...extra];
  }, [data, ia.tracks]);

  // FILTRO ESTRICTO: con búsquedas de artista o disco ("Jaguar del Alba",
  // "Herida Eterna") la pestaña de canciones solo muestra pistas cuya
  // combinación título+artista+álbum contiene TODOS los términos. Con un solo
  // término no se recorta (las radios por género/tag siguen enteras).
  const strictSongs = useMemo(
    () => allSongs.filter((t) => trackMatchesQuery(q.trim(), t)),
    [allSongs, q]
  );

  // Registrar la búsqueda cuando se confirma (Enter) o al pulsar una sugerencia.
  const commitSearch = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length >= 2) addSearch(trimmed);
    setQ(trimmed);
    push({ type: "search", q: trimmed || undefined });
    toggleHistory(false);
  };

  // Sincronizar con la query externa al navegar (patrón de ajuste en render).
  const externalQ = initialQ ?? "";
  const [lastExternalQ, setLastExternalQ] = useState(externalQ);
  if (externalQ !== lastExternalQ) {
    setLastExternalQ(externalQ);
    setQ(externalQ);
  }

  const hasQuery = q.trim().length >= 2;

  if (!hasQuery) {
    return (
      <div className="px-4 pb-8 pt-4 sm:px-6">
        {/* Botón atrás (←) visible en toda la vista de búsqueda */}
        <div className="mb-3">
          <BackButton tone="plain" />
        </div>
        <h1 className="text-xl font-extrabold sm:text-2xl">Explorar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Busca canciones, álbumes o artistas con audio completo y legal, o elige un género para empezar.
        </p>

        {/* Buscador con historial (móvil) */}
        <div className="relative mt-4 md:hidden" ref={searchBoxRef}>
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (histOpen) toggleHistory(false);
              push({ type: "search", q: e.target.value.trim() || undefined });
            }}
            onFocus={() => toggleHistory(true)}
            onClick={() => toggleHistory(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitSearch(q);
                (e.target as HTMLInputElement).blur();
              } else if (e.key === "Escape") {
                toggleHistory(false);
              }
            }}
            placeholder="Buscar…"
            className="h-11 w-full rounded-full border border-border bg-secondary/70 pl-10 pr-4 text-sm focus:border-vortex/60 focus:outline-none"
          />
          {histOpen && (
            <RecentSearchesPanel
              onSelect={(sel) => {
                commitSearch(sel);
              }}
            />
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => commitSearch(s)}
              className="rounded-full bg-secondary/80 px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Object.entries(GENRES).map(([slug, g], i) => (
            <button
              key={slug}
              onClick={() => push({ type: "genre", slug })}
              className="flex h-24 items-end overflow-hidden rounded-xl p-4 text-left transition-transform hover:scale-[1.02]"
              style={{ backgroundImage: `linear-gradient(135deg, hsl(${220 + i * 14} 90% ${38 + (i % 3) * 6}%), hsl(${262 + i * 10} 85% ${46 + (i % 2) * 8}%))` }}
              aria-label={`Radio de ${g.label}`}
            >
              <span className="text-base font-extrabold text-white">{g.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (error) return <ErrorState onRetry={reload} message={error} />;

  return (
    <div className="px-4 pb-8 pt-4 sm:px-6">
      {/* Botón atrás (←) también con resultados activos */}
      <div className="mb-3">
        <BackButton tone="plain" />
      </div>
      {/* Input grande en móvil */}
      <div className="relative mb-4 md:hidden" ref={searchBoxRef}>
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (histOpen) toggleHistory(false);
            push({ type: "search", q: e.target.value.trim() || undefined });
          }}
          onFocus={() => toggleHistory(true)}
          onClick={() => toggleHistory(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commitSearch(q);
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              toggleHistory(false);
            }
          }}
          placeholder="Buscar…"
          className="h-11 w-full rounded-full border border-border bg-secondary/70 pl-10 pr-4 text-sm focus:border-vortex/60 focus:outline-none"
        />
        {histOpen && (
          <RecentSearchesPanel
            onSelect={(sel) => {
              commitSearch(sel);
            }}
          />
        )}
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <h1 className="min-w-0 truncate text-lg font-extrabold sm:text-xl">
          Resultados para <span className="vortex-text-gradient">“{q}”</span>
        </h1>
        <Tabs value={tab} onValueChange={setTab} className="shrink-0">
          <TabsList className="bg-secondary/70">
            <TabsTrigger value="all" className="text-xs">Todo</TabsTrigger>
            <TabsTrigger value="songs" className="text-xs">Canciones</TabsTrigger>
            <TabsTrigger value="albums" className="text-xs">Álbum</TabsTrigger>
            <TabsTrigger value="artists" className="text-xs">Artistas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="space-y-8">
          <RowsSkeleton count={5} />
          <CardsSkeleton count={5} />
        </div>
      ) : !data ? null : (
        <>
          {tab === "all" && (
            <div className="space-y-8">
              {strictSongs.length === 0 && allArtists.length === 0 && albums.length === 0 && !iaLoading && (
                <EmptyState
                  title="Sin resultados"
                  message={`No encontramos nada para “${q}”. Prueba con otro término o género.`}
                />
              )}
              {allArtists.length > 0 && (
                <section>
                  <h2 className="mb-3 text-lg font-bold">Artistas</h2>
                  <div className="flex gap-1 overflow-hidden">
                    {allArtists.slice(0, 8).map((a) => (
                      <CarouselItem key={a.id}>
                        <MediaCard
                          kind="artist"
                          title={a.name}
                          subtitle={a.genre ?? "Artista"}
                          artwork={a.artwork}
                          onOpen={() => push({ type: "artist", id: a.id })}
                          onPlay={() => playArtistTop(a.id, a.name)}
                          onPrefetch={() => {
                            // Los artistas de IA se cargan client-side (su
                            // módulo ya cachea); el prefetch HTTP es solo para
                            // las APIs del servidor.
                            if (!a.id.startsWith("ia-")) prefetch.artist(a.id);
                          }}
                        />
                      </CarouselItem>
                    ))}
                  </div>
                </section>
              )}
              {albums.length > 0 && (
                <section>
                  <h2 className="mb-3 text-lg font-bold">
                    Álbumes <span className="text-sm font-medium text-muted-foreground">· discos completos</span>
                  </h2>
                  <div className="flex gap-1 overflow-hidden">
                    {albums.slice(0, 8).map((a) => (
                      <CarouselItem key={a.id}>
                        <AlbumCard album={a} />
                      </CarouselItem>
                    ))}
                  </div>
                </section>
              )}
              {strictSongs.length > 0 && (
                <section>
                  <h2 className="mb-3 text-lg font-bold">Canciones</h2>
                  <TrackList
                    tracks={strictSongs.slice(0, 8)}
                    playContext={strictSongs}
                    contextTitle={`Búsqueda: ${q}`}
                    showIndex={false}
                  />
                </section>
              )}
              {iaLoading && (
                <p className={cn("text-xs text-muted-foreground", strictSongs.length === 0 && albums.length === 0 && "mt-2")}>
                  Buscando también en Internet Archive (discos completos incluidos)…
                </p>
              )}
            </div>
          )}

          {tab === "songs" && (
            <>
              {strictSongs.length > 0 ? (
                <TrackList tracks={strictSongs} contextTitle={`Búsqueda: ${q}`} showIndex={false} />
              ) : (
                !iaLoading && (
                  <EmptyState
                    title="Sin canciones exactas"
                    message={`Ninguna canción coincide estrictamente con “${q}” (título, artista o álbum).`}
                  />
                )
              )}
              {iaLoading && strictSongs.length === 0 && <RowsSkeleton count={5} />}
              {iaLoading && strictSongs.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Buscando también en Internet Archive…</p>
              )}
            </>
          )}

          {tab === "albums" && (
            <>
              {albums.length > 0 ? (
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                  {albums.map((a) => (
                    <AlbumCard key={a.id} album={a} />
                  ))}
                </div>
              ) : iaLoading ? (
                <CardsSkeleton count={5} />
              ) : (
                <EmptyState
                  title="Sin álbumes"
                  message={`No hay discos completos para “${q}”. Los discos que se suban a Internet Archive aparecerán aquí automáticamente.`}
                />
              )}
            </>
          )}

          {tab === "artists" && (
            <>
              {allArtists.length > 0 ? (
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                  {allArtists.map((a) => (
                    <MediaCard
                      key={a.id}
                      kind="artist"
                      title={a.name}
                      subtitle={a.genre ?? "Artista"}
                      artwork={a.artwork}
                      onOpen={() => push({ type: "artist", id: a.id })}
                      onPlay={() => playArtistTop(a.id, a.name)}
                      onPrefetch={() => {
                        if (!a.id.startsWith("ia-")) prefetch.artist(a.id);
                      }}
                    />
                  ))}
                </div>
              ) : iaLoading ? (
                <CardsSkeleton count={5} circle />
              ) : (
                <EmptyState
                  title="Sin artistas"
                  message={`No encontramos perfiles de artista para “${q}”.`}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// Tarjeta del "resultado principal" para la pestaña Todo (opcional, futura iteración).
export function TopResultCard({ track }: { track: Track }) {
  const playQueue = usePlayer((s) => s.playQueue);
  const active = usePlayer((s) => s.current()?.id === track.id);
  return (
    <div
      onClick={() => playQueue([track], 0, "Resultado principal")}
      className={cn("flex cursor-pointer items-center gap-4 rounded-xl bg-secondary/70 p-4 transition-colors hover:bg-secondary")}
    >
      <div className="h-20 w-20 overflow-hidden rounded-lg bg-secondary" />
      <div className="min-w-0">
        <p className="truncate text-lg font-bold">{track.title}</p>
        <p className="truncate text-sm text-muted-foreground">{track.artist}</p>
      </div>
    </div>
  );
}
