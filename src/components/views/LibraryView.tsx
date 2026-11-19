"use client";

import { Heart, ListPlus, Plus } from "lucide-react";
import { useLibrary } from "@/store/library";
import { usePlayer } from "@/store/player";
import { useNav } from "@/store/nav";
import { useCreatePlaylistDialog } from "@/store/dialogs";
import { MediaCard } from "@/components/music/MediaCard";
import { PlaylistCover } from "@/components/dialogs/AddToPlaylistDialog";
import { Section, CarouselItem } from "@/components/music/Section";
import { EmptyState } from "@/components/music/ViewHeader";
import { PLAYLIST_GRADIENTS } from "@/lib/format";

export function LibraryView() {
  const playlists = useLibrary((s) => s.playlists);
  const likedCount = useLibrary((s) => s.likedTracks.length);
  const recentlyPlayed = useLibrary((s) => s.recentlyPlayed);
  const openCreatePlaylist = useCreatePlaylistDialog((s) => s.openCreate);
  const push = useNav((s) => s.push);
  const playQueue = usePlayer((s) => s.playQueue);
  const currentId = usePlayer((s) => (s.index >= 0 && s.index < s.queue.length ? s.queue[s.index]?.id : null));

  const handleCreate = () => {
    openCreatePlaylist();
  };

  return (
    <div className="px-4 pb-8 pt-4 sm:px-6">
      <h1 className="text-xl font-extrabold sm:text-2xl">Tu biblioteca</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Playlists, favoritos y lo último que escuchaste. Se guarda en tu navegador.
      </p>

      {/* Acceso a Me gusta */}
      <button
        onClick={() => push({ type: "liked" })}
        className="group mt-6 flex w-full items-center gap-4 rounded-xl bg-secondary/60 p-4 text-left transition-colors hover:bg-secondary"
      >
        <span className="vortex-gradient flex h-14 w-14 shrink-0 items-center justify-center rounded-lg">
          <Heart className="h-6 w-6 fill-white text-white" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Me gusta</span>
          <span className="block text-xs text-muted-foreground">
            {likedCount} {likedCount === 1 ? "canción guardada" : "canciones guardadas"}
          </span>
        </span>
        <Heart className="h-5 w-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>

      {/* Playlists */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Playlists</h2>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-full bg-secondary/80 px-4 py-2 text-sm font-bold transition-colors hover:bg-secondary"
          >
            <Plus className="h-4 w-4" /> Crear playlist
          </button>
        </div>
        {playlists.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8">
            <EmptyState
              title="Sin playlists todavía"
              message="Crea una playlist y organiza tus canciones favoritas."
              icon={<ListPlus className="h-7 w-7" />}
            />
            <div className="flex justify-center">
              <button
                onClick={handleCreate}
                className="vortex-gradient flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white transition-transform hover:scale-105"
              >
                <Plus className="h-4 w-4" /> Crear mi primera playlist
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {playlists.map((pl) => (
              <div key={pl.id} className="group relative rounded-xl p-3 transition-colors hover:bg-secondary/80">
                <button
                  onClick={() => push({ type: "playlist", id: pl.id })}
                  className="w-full text-left"
                  aria-label={`Abrir playlist ${pl.name}`}
                >
                  <div className="relative mb-3 aspect-square">
                    <PlaylistCover gradient={pl.gradient} className="h-full w-full" />
                    <span
                      className="vortex-gradient absolute bottom-2 right-2 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full text-white opacity-0 shadow-xl transition-all group-hover:translate-y-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (pl.tracks.length > 0) playQueue(pl.tracks, 0, pl.name);
                      }}
                    >
                      <ListPlus className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="truncate text-sm font-semibold">{pl.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pl.tracks.length} {pl.tracks.length === 1 ? "canción" : "canciones"}
                  </p>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Escuchado recientemente */}
      {recentlyPlayed.length > 0 && (
        <Section title="Escuchado recientemente">
          {recentlyPlayed.map((t, i) => (
            <CarouselItem key={`${t.id}-${i}`}>
              <MediaCard
                kind="track"
                title={t.title}
                subtitle={t.artist}
                artwork={t.artwork}
                active={currentId === t.id}
                onOpen={() => playQueue(recentlyPlayed, i, "Escuchado recientemente")}
                onPlay={() => playQueue(recentlyPlayed, i, "Escuchado recientemente")}
              />
            </CarouselItem>
          ))}
        </Section>
      )}

      {/* Paleta de la marca (decorativa) */}
      <div className="mt-10 flex items-center gap-2">
        {PLAYLIST_GRADIENTS.map((g, i) => (
          <span key={i} className="h-1.5 flex-1 rounded-full" style={{ backgroundImage: g }} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}
