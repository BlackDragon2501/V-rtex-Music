"use client";

import { Heart, ListPlus, ListStart, MoreVertical, Music2, Play, Trash2, User, ListEnd } from "lucide-react";
import { toast } from "sonner";
import { AlbumArt } from "./AlbumArt";
import { cn, } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import type { Track } from "@/lib/music/types";
import { usePlayer } from "@/store/player";
import { useLibrary } from "@/store/library";
import { useNav } from "@/store/nav";
import { useAddToPlaylist } from "@/store/dialogs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TrackRowProps {
  track: Track;
  tracks?: Track[]; // contexto de la lista para reproducir en orden
  contextTitle?: string;
  index?: number;
  showArt?: boolean;
  showAlbum?: boolean;
  showIndex?: boolean;
  onRemoveFromPlaylist?: () => void;
  onRemoveFromQueue?: () => void;
}

export function TrackRow({
  track,
  tracks,
  contextTitle,
  index,
  showArt = true,
  showAlbum = true,
  showIndex = false,
  onRemoveFromPlaylist,
  onRemoveFromQueue,
}: TrackRowProps) {
  const playQueue = usePlayer((s) => s.playQueue);
  const playTrackNow = usePlayer((s) => s.playTrackNow);
  const playNextUp = usePlayer((s) => s.playNextUp);
  const addToQueue = usePlayer((s) => s.addToQueue);
  const currentId = usePlayer((s) => (s.index >= 0 && s.index < s.queue.length ? s.queue[s.index]?.id : null));
  const isPlaying = usePlayer((s) => s.isPlaying);
  const toggleLike = useLibrary((s) => s.toggleLike);
  const isLiked = useLibrary((s) => s.likedTracks.some((x) => x.id === track.id));
  const openAddToPlaylist = useAddToPlaylist((s) => s.openFor);
  const push = useNav((s) => s.push);

  const active = currentId === track.id;
  const canGoArtist = Boolean(track.artistId);

  const handlePlay = () => {
    if (tracks && tracks.length > 0) {
      const i = index ?? tracks.findIndex((t) => t.id === track.id);
      playQueue(tracks, Math.max(0, i), contextTitle ?? "Vórtex Music");
    } else {
      playTrackNow(track, contextTitle);
    }
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors sm:gap-4 sm:px-3",
        active ? "bg-secondary/90" : "hover:bg-secondary/60"
      )}
      onClick={handlePlay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handlePlay();
        }
      }}
      aria-label={`Reproducir ${track.title} de ${track.artist}`}
    >
      {showIndex && index !== undefined && (
        <span className={cn("w-6 text-right text-sm tabular-nums", active ? "text-vortex-soft" : "text-muted-foreground")}>
          {index + 1}
        </span>
      )}

      {showArt && (
        <div className="relative h-11 w-11 shrink-0 sm:h-12 sm:w-12">
          <AlbumArt src={track.artwork} alt={track.title} rounded="rounded-md" className="h-full w-full" />
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-md bg-black/50 transition-opacity",
              active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            {active && isPlaying ? (
              <span className="flex h-4 items-end gap-[2px]" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="eq-bar w-[3px] rounded-full bg-vortex-glow" style={{ animationDelay: `${i * 0.18}s` }} />
                ))}
              </span>
            ) : (
              <Play className="h-4 w-4 fill-white text-white" />
            )}
          </span>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", active ? "text-vortex-soft" : "text-foreground")}>
          {track.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          <span className="truncate">{track.artist}</span>
        </p>
      </div>

      {showAlbum && track.album && (
        <span className="hidden w-[28%] truncate text-xs text-muted-foreground lg:block">{track.album}</span>
      )}

      <span className="hidden items-center gap-1 sm:flex">
        <button
          onClick={(e) => {
            e.stopPropagation();
            const liked = toggleLike(track);
            toast(liked ? "Añadido a Me gusta" : "Quitado de Me gusta");
          }}
          aria-label={isLiked ? "Quitar de Me gusta" : "Añadir a Me gusta"}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Heart className={cn("h-4 w-4", isLiked && "fill-vortex-2 text-vortex-2 opacity-100")} />
        </button>
      </span>

      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
        {formatDuration(track.duration)}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button
            aria-label={`Más opciones para ${track.title}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all hover:bg-secondary hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={4}
          className="w-60 border-border bg-popover/95 backdrop-blur"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem onClick={handlePlay}>
            <Play className="h-4 w-4" /> Reproducir
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              playNextUp(track);
              toast("Se reproducirá a continuación");
            }}
          >
            <ListStart className="h-4 w-4" /> Siguiente en la cola
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              addToQueue(track);
              toast("Añadido a la cola");
            }}
          >
            <ListEnd className="h-4 w-4" /> Añadir a la cola
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              const liked = toggleLike(track);
              toast(liked ? "Añadido a Me gusta" : "Quitado de Me gusta");
            }}
          >
            <Heart className={cn("h-4 w-4", isLiked && "fill-vortex-2 text-vortex-2")} />
            {isLiked ? "Quitar de Me gusta" : "Añadir a Me gusta"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openAddToPlaylist(track)}>
            <ListPlus className="h-4 w-4" /> Añadir a una playlist
          </DropdownMenuItem>
          {canGoArtist && <DropdownMenuSeparator />}
          {canGoArtist && (
            <DropdownMenuItem onClick={() => push({ type: "artist", id: track.artistId! })}>
              <User className="h-4 w-4" /> Ir al artista
            </DropdownMenuItem>
          )}
          {(onRemoveFromPlaylist || onRemoveFromQueue) && <DropdownMenuSeparator />}
          {onRemoveFromPlaylist && (
            <DropdownMenuItem onClick={onRemoveFromPlaylist} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" /> Quitar de esta playlist
            </DropdownMenuItem>
          )}
          {onRemoveFromQueue && (
            <DropdownMenuItem onClick={onRemoveFromQueue} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" /> Quitar de la cola
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function TrackList({
  tracks,
  contextTitle,
  showAlbum = true,
  showIndex = true,
  startIndex = 0,
  playContext,
  onRemoveFromPlaylist,
}: {
  tracks: Track[];
  contextTitle?: string;
  showAlbum?: boolean;
  showIndex?: boolean;
  // Numeración continua cuando la lista se parte en varias secciones
  // (p. ej. las tandas del botón "Más canciones").
  startIndex?: number;
  // Cola de reproducción real cuando la vista muestra varias tandas de una
  // misma lista: cualquier fila reproduce dentro de esta cola completa.
  playContext?: Track[];
  onRemoveFromPlaylist?: (track: Track) => void;
}) {
  const queue = playContext ?? tracks;
  return (
    <div className="flex flex-col gap-0.5">
      {tracks.map((t, i) => (
        <TrackRow
          key={`${t.id}-${i}`}
          track={t}
          tracks={queue}
          index={startIndex + i}
          contextTitle={contextTitle}
          showAlbum={showAlbum}
          showIndex={showIndex}
          onRemoveFromPlaylist={onRemoveFromPlaylist ? () => onRemoveFromPlaylist(t) : undefined}
        />
      ))}
      {tracks.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Music2 className="h-8 w-8" />
          <p className="text-sm">No hay canciones aquí todavía</p>
        </div>
      )}
    </div>
  );
}
