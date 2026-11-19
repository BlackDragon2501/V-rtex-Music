"use client";

import { ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { AlbumArt } from "./AlbumArt";
import { cn } from "@/lib/utils";
import { usePlayer } from "@/store/player";
import { useNav } from "@/store/nav";
import type { Album } from "@/lib/music/types";

interface MediaCardProps {
  kind: "album" | "artist" | "playlist" | "track";
  title: string;
  subtitle?: string;
  artwork: string | null;
  badge?: ReactNode;
  onOpen: () => void;
  onPlay?: () => void;
  onPrefetch?: () => void; // precarga al pasar el cursor / enfocar (carga instantánea)
  active?: boolean; // pista actual sonando
}

// Tarjeta estilo Spotify/YT Music con botón de reproducción al pasar el cursor.
export function MediaCard({ kind, title, subtitle, artwork, badge, onOpen, onPlay, onPrefetch, active }: MediaCardProps) {
  const isPlaying = usePlayer((s) => s.isPlaying);
  const rounded = kind === "artist" ? "rounded-full" : "rounded-lg";
  const playing = active === true && isPlaying;

  return (
    <div
      className="group relative w-full cursor-pointer rounded-xl p-3 transition-colors hover:bg-secondary/80"
      onClick={onOpen}
      onPointerEnter={onPrefetch}
      onTouchStart={onPrefetch}
      onFocus={onPrefetch}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
      aria-label={`${title}${subtitle ? ` de ${subtitle}` : ""}`}
    >
      <div className="relative mb-3 aspect-square w-full overflow-hidden">
        <AlbumArt
          src={artwork}
          alt={title}
          rounded={rounded}
          className="h-full w-full shadow-lg"
          iconClassName={kind === "artist" ? "h-2/5 w-2/5" : "h-1/3 w-1/3 max-h-14 max-w-14"}
        />
        {onPlay && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            aria-label={playing ? `Pausar ${title}` : `Reproducir ${title}`}
            className={cn(
              "absolute bottom-2 right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full",
              "vortex-gradient text-white shadow-xl shadow-black/40 transition-all duration-200",
              "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100",
              playing && "translate-y-0 opacity-100"
            )}
          >
            {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 translate-x-[1px] fill-current" />}
          </button>
        )}
        {active && (
          <span className="absolute left-2 top-2 flex h-5 items-end gap-[2px]" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn("w-[3px] rounded-full bg-vortex-glow", isPlaying ? "eq-bar" : "h-[30%]")}
                style={isPlaying ? { animationDelay: `${i * 0.18}s` } : undefined}
              />
            ))}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-semibold", active ? "text-vortex-soft" : "text-foreground")}>
          {title}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle ?? "\u00A0"}</p>
        {badge && <div className="mt-1.5">{badge}</div>}
      </div>
    </div>
  );
}

// Tarjeta de disco completo: clic → vista del álbum con todas sus canciones;
// botón de play → disco entero en cola. Usada en búsqueda (pestaña Álbum y
// sección de Todo) y en la página de artista.
export function AlbumCard({ album }: { album: Album }) {
  const push = useNav((s) => s.push);
  const playQueue = usePlayer((s) => s.playQueue);
  const currentId = usePlayer((s) => s.current()?.id);
  const thisAlbumPlaying = album.tracks.some((t) => t.id === currentId);

  return (
    <MediaCard
      kind="album"
      title={album.title}
      subtitle={album.artist}
      artwork={album.artwork}
      active={thisAlbumPlaying}
      onOpen={() => push({ type: "album", id: album.id })}
      onPlay={() => {
        if (album.tracks.length === 0) return;
        if (thisAlbumPlaying) {
          usePlayer.getState().togglePlay();
          return;
        }
        playQueue(album.tracks, 0, `Álbum · ${album.title}`);
      }}
    />
  );
}
