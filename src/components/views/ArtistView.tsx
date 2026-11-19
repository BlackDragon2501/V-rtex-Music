"use client";

import { Pause, Play, Shuffle, BadgeCheck } from "lucide-react";
import { api, prefetch } from "@/lib/api-client";
import { iaBrowserArtistDetail } from "@/lib/music/ia-browser";
import { useAsync } from "@/hooks/use-async";
import { usePlayer } from "@/store/player";
import { ViewHeader, ErrorState, RowsSkeleton, CardsSkeleton } from "@/components/music/ViewHeader";
import { TrackList } from "@/components/music/TrackRow";
import { AlbumCard } from "@/components/music/MediaCard";
import { CarouselItem } from "@/components/music/Section";
import { cnBtn } from "./cnBtn";

export function ArtistView({ id }: { id: string }) {
  // Internet Archive: artistas client-side (creadores de IA; la IP del
  // servidor suele estar bloqueada por su anti-abuso). El resto, APIs propias.
  const isIa = id.startsWith("ia-");
  const { data, loading, error, reload } = useAsync(
    () => (isIa ? iaBrowserArtistDetail(id) : api.artist(id)),
    [id]
  );
  const playQueue = usePlayer((s) => s.playQueue);
  const current = usePlayer((s) => s.current());
  const isPlaying = usePlayer((s) => s.isPlaying);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const shuffle = usePlayer((s) => s.shuffle);

  if (error) return <ErrorState onRetry={reload} message={error} />;
  if (loading) {
    return (
      <div className="px-4 py-4 sm:px-6">
        <RowsSkeleton count={6} />
        <div className="mt-8"><CardsSkeleton count={5} /></div>
      </div>
    );
  }
  if (!data) return null;

  const { artist, topSongs } = data;
  const albums = data.albums ?? [];
  const thisArtistPlaying = topSongs.some((t) => t.id === current?.id);

  const playAll = (start = 0) => {
    if (topSongs.length === 0) return;
    playQueue(topSongs, start, `Populares · ${artist.name}`);
  };

  return (
    <div className="pb-8">
      <ViewHeader
        kindLabel="Artista"
        title={artist.name}
        artwork={artist.artwork}
        circle
        meta={
          <span className="flex flex-wrap items-center gap-2">
            {artist.genre && (
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                {artist.genre}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-white/70">
              {isIa ? (
                <>Catálogo libre · Internet Archive</>
              ) : (
                <>
                  <BadgeCheck className="h-3.5 w-3.5 text-vortex-soft" /> Perfil verificado en el catálogo
                </>
              )}
            </span>
          </span>
        }
        actions={
          <>
            <button
              onClick={() => (thisArtistPlaying ? togglePlay() : playAll(0))}
              aria-label={thisArtistPlaying && isPlaying ? "Pausar" : "Reproducir"}
              className="flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-[#0b1220] transition-transform hover:scale-105"
            >
              {thisArtistPlaying && isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
              Reproducir
            </button>
            <button
              onClick={() => {
                if (!shuffle) toggleShuffle();
                playAll(Math.floor(Math.random() * Math.max(1, topSongs.length)));
              }}
              aria-label="Reproducir aleatorio"
              className={cnBtn(shuffle)}
            >
              <Shuffle className="h-5 w-5" /> Aleatorio
            </button>
          </>
        }
      />

      {/* Discos completos agrupados por objeto IA (subidas presentes y futuras). */}
      {albums.length > 0 && (
        <section className="px-2 pt-6 sm:px-6">
          <h2 className="mb-3 px-1 text-lg font-bold sm:px-2">Álbumes</h2>
          <div className="flex gap-1 overflow-hidden">
            {albums.map((a) => (
              <CarouselItem key={a.id}>
                <AlbumCard album={a} />
              </CarouselItem>
            ))}
          </div>
        </section>
      )}

      {topSongs.length > 0 && (
        <section className="px-2 pt-6 sm:px-6">
          <h2 className="mb-3 px-1 text-lg font-bold sm:px-2">Populares</h2>
          {/* En IA el artista tiene TODO su catálogo a la vista (discos
              completos); en el resto, el top 10 de siempre. */}
          <TrackList
            tracks={isIa ? topSongs : topSongs.slice(0, 10)}
            contextTitle={`Populares · ${artist.name}`}
            showIndex
            showAlbum
          />
        </section>
      )}
    </div>
  );
}

// Precarga al pasar el cursor (se mantiene la API pública del módulo).
export function prefetchArtist(id: string) {
  prefetch.artist(id);
}
