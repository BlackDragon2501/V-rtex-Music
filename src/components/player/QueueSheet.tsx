"use client";

import { ListMusic, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { QueueRow } from "./QueuePanel";
import { usePlayer } from "@/store/player";
import { usePlayerAudio } from "./PlayerProvider";

// Bottom sheet con TODA la cola de reproducción (estilo YouTube Music).
// Se abre al tocar la tarjeta "Siguiente" de la pantalla de reproducción.
export function QueueSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const playPlaylistAt = usePlayer((s) => s.playPlaylistAt);
  const removeFromQueue = usePlayer((s) => s.removeFromQueue);
  const clearQueue = usePlayer((s) => s.clearQueue);
  const { restart } = usePlayerAudio();

  const current = index >= 0 && index < queue.length ? queue[index] : null;
  const upcoming = queue.map((t, i) => ({ t, i })).filter(({ i }) => i !== index);

  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="z-[70] mx-auto max-h-[82dvh] w-full gap-0 rounded-t-3xl border-white/10 bg-[#0a0f1c] p-0 sm:max-w-lg"
        aria-describedby={undefined}
      >
        {/* Asa del bottom sheet */}
        <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-white/25" aria-hidden="true" />

        <SheetHeader className="shrink-0 px-5 pb-3 pt-3 text-left">
          <SheetTitle className="flex items-center gap-2 text-lg font-extrabold text-white">
            <ListMusic className="h-5 w-5 text-vortex-soft" /> Cola de reproducción
          </SheetTitle>
          <SheetDescription className="text-xs text-white/60">
            {queue.length} {queue.length === 1 ? "canción" : "canciones"} · {upcoming.length} por venir
          </SheetDescription>
        </SheetHeader>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-2">
          {current ? (
            <>
              <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                Reproduciendo ahora
              </p>
              <QueueRow
                title={current.title}
                artist={current.artist}
                artwork={current.artwork}
                duration={current.duration}
                active
                showRemove
                onClick={restart}
              />
              <p className="px-2 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                A continuación ({upcoming.length})
              </p>
              {upcoming.length === 0 ? (
                <p className="px-2 py-6 text-sm text-white/60">
                  No hay más canciones en la cola. Añade canciones desde el menú ⋯ de cualquier pista.
                </p>
              ) : (
                <div className="flex flex-col gap-0.5 pb-2">
                  {upcoming.map(({ t, i }) => (
                    <QueueRow
                      key={`${t.id}-${i}`}
                      title={t.title}
                      artist={t.artist}
                      artwork={t.artwork}
                      duration={t.duration}
                      showRemove
                      onClick={() => {
                        playPlaylistAt(i);
                        close();
                      }}
                      onRemove={() => removeFromQueue(i)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="px-2 py-8 text-center text-sm text-white/60">
              Nada en reproducción todavía.
            </p>
          )}
        </div>

        {current && queue.length > 1 && (
          <div className="shrink-0 border-t border-white/10 p-3">
            <button
              onClick={clearQueue}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Trash2 className="h-4 w-4" /> Limpiar cola
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
