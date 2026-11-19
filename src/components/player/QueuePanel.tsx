"use client";

import { X, Trash2, Music2 } from "lucide-react";
import { AlbumArt } from "@/components/music/AlbumArt";
import { usePlayer } from "@/store/player";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import { Play } from "lucide-react";
import { usePlayerAudio } from "./PlayerProvider";

// Panel lateral con la cola de reproducción (estilo Spotify).
export function QueuePanel({ mounted = true }: { mounted?: boolean }) {
  const queueOpen = usePlayer((s) => mounted && s.queueOpen);
  const setQueueOpen = usePlayer((s) => s.setQueueOpen);
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const playPlaylistAt = usePlayer((s) => s.playPlaylistAt);
  const removeFromQueue = usePlayer((s) => s.removeFromQueue);
  const clearQueue = usePlayer((s) => s.clearQueue);
  const { restart } = usePlayerAudio();

  const current = index >= 0 && index < queue.length ? queue[index] : null;
  const upcoming = queue.map((t, i) => ({ t, i })).filter(({ i }) => i !== index);

  return (
    <>
      {/* Fondo móvil para cerrar */}
      {queueOpen && (
        <button
          className="absolute inset-0 z-20 bg-black/50 sm:hidden"
          onClick={() => setQueueOpen(false)}
          aria-label="Cerrar cola"
        />
      )}
      <aside
        className={cn(
          "absolute inset-y-0 right-0 z-30 flex w-full transform flex-col border-l border-border bg-[#0a0f1c]/95 backdrop-blur transition-transform duration-300 sm:w-[340px]",
          queueOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!queueOpen}
        aria-label="Cola de reproducción"
      >
        {mounted && (
          <>
        <div className="flex items-center justify-between px-4 py-4">
          <h3 className="text-base font-bold">Cola</h3>
          <button
            onClick={() => setQueueOpen(false)}
            aria-label="Cerrar cola"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-4">
          {current ? (
            <>
              <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Reproduciendo ahora
              </p>
              <QueueRow
                title={current.title}
                artist={current.artist}
                artwork={current.artwork}
                duration={current.duration}
                active
                onClick={restart}
              />
              <p className="px-2 pb-2 pt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                A continuación ({upcoming.length})
              </p>
              {upcoming.length === 0 && (
                <p className="px-2 py-6 text-sm text-muted-foreground">
                  La cola está vacía. Añade canciones desde cualquier lista con el menú de cada pista.
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {upcoming.map(({ t, i }) => (
                  <QueueRow
                    key={`${t.id}-${i}`}
                    title={t.title}
                    artist={t.artist}
                    artwork={t.artwork}
                    duration={t.duration}
                    onClick={() => playPlaylistAt(i)}
                    onRemove={() => removeFromQueue(i)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 px-4 py-16 text-center text-muted-foreground">
              <Music2 className="h-10 w-10" />
              <p className="text-sm">Nada en reproducción todavía</p>
              <p className="text-xs">Reproduce algo y la cola aparecerá aquí.</p>
            </div>
          )}
        </div>

        {current && queue.length > 1 && (
          <div className="border-t border-border p-3">
            <button
              onClick={clearQueue}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" /> Limpiar cola
            </button>
          </div>
        )}
          </>
        )}
      </aside>
    </>
  );
}

export function QueueRow({
  title,
  artist,
  artwork,
  duration,
  active,
  onClick,
  onRemove,
  showRemove = false,
}: {
  title: string;
  artist: string;
  artwork: string | null;
  duration: number;
  active?: boolean;
  onClick: () => void;
  onRemove?: () => void;
  showRemove?: boolean; // botón siempre visible (paneles táctiles)
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors",
        active ? "bg-secondary/90" : "hover:bg-secondary/60"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
      }}
    >
      <div className="relative h-10 w-10 shrink-0">
        <AlbumArt src={artwork} alt={title} rounded="rounded-md" className="h-full w-full" />
        <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-4 w-4 fill-white text-white" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", active && "text-vortex-soft")}>{title}</p>
        <p className="truncate text-xs text-muted-foreground">{artist}</p>
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{formatDuration(duration)}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Quitar ${title} de la cola`}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all hover:text-destructive",
            showRemove ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
