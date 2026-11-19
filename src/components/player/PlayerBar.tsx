"use client";

import { useState } from "react";
import {
  Heart,
  ListMusic,
  Maximize2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AlbumArt } from "@/components/music/AlbumArt";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/store/player";
import { useLibrary } from "@/store/library";
import { useAudioProgress, usePlayerAudio } from "./PlayerProvider";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import { toast } from "sonner";

function Controls({ big = false }: { big?: boolean }) {
  const { audio, restart } = usePlayerAudio();
  const { pos } = useAudioProgress();
  const isPlaying = usePlayer((s) => s.isPlaying);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const current = usePlayer((s) => s.current());
  const togglePlay = usePlayer((s) => s.togglePlay);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const hasQueue = usePlayer((s) => s.queue.length > 0);

  const iconSize = big ? "h-6 w-6" : "h-5 w-5";

  const handlePrev = () => {
    if (audio && pos > 3) restart();
    else prev();
  };

  return (
    <div className={cn("flex items-center justify-center", big ? "gap-6" : "gap-3 sm:gap-4")}>
      <button
        onClick={toggleShuffle}
        aria-label="Aleatorio"
        aria-pressed={shuffle}
        title="Aleatorio"
        className={cn(
          "hidden h-9 w-9 items-center justify-center rounded-full transition-colors sm:flex",
          shuffle ? "text-vortex-soft hover:text-vortex-soft" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Shuffle className={iconSize} />
      </button>
      <button
        onClick={handlePrev}
        disabled={!hasQueue}
        aria-label="Anterior"
        title="Anterior"
        className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:text-white disabled:opacity-40"
      >
        <SkipBack className={cn(iconSize, "fill-current")} />
      </button>
      <button
        onClick={() => (current ? togglePlay() : undefined)}
        disabled={!current}
        aria-label={isPlaying ? "Pausar" : "Reproducir"}
        title={isPlaying ? "Pausar" : "Reproducir"}
        className={cn(
          "flex items-center justify-center rounded-full vortex-gradient text-white shadow-lg shadow-vortex/25 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100",
          big ? "h-14 w-14" : "h-10 w-10"
        )}
      >
        {isPlaying ? (
          <Pause className={cn(big ? "h-6 w-6" : "h-4 w-4", "fill-current")} />
        ) : (
          <Play className={cn(big ? "h-6 w-6" : "h-4 w-4", "translate-x-[1px] fill-current")} />
        )}
      </button>
      <button
        onClick={() => next()}
        disabled={!hasQueue}
        aria-label="Siguiente"
        title="Siguiente"
        className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:text-white disabled:opacity-40"
      >
        <SkipForward className={cn(iconSize, "fill-current")} />
      </button>
      <button
        onClick={cycleRepeat}
        aria-label={`Repetir: ${repeat === "off" ? "desactivado" : repeat === "all" ? "toda la cola" : "una pista"}`}
        aria-pressed={repeat !== "off"}
        title={repeat === "off" ? "Repetir desactivado" : repeat === "all" ? "Repetir toda la cola" : "Repetir pista actual"}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
          repeat !== "off" ? "text-vortex-soft hover:text-vortex-soft" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {repeat === "one" ? <Repeat1 className={iconSize} /> : <Repeat className={iconSize} />}
      </button>
    </div>
  );
}

function ProgressBar({ big = false }: { big?: boolean }) {
  const { seek } = usePlayerAudio();
  const { pos, dur } = useAudioProgress();
  const [dragging, setDragging] = useState<number | null>(null);
  // Barra y contador SIEMPRE basados en la duración real del audio en reproducción
  // (audio.duration), nunca en los metadatos del catálogo: si el archivo dura 5:03
  // el reproductor muestra 5:03, aunque el catálogo diga otra cosa.
  const value = dragging ?? pos;
  const max = dur > 0 ? dur : 1;
  const total = dur > 0 ? dur : 0;
  const shown = Math.min(value, max);

  return (
    <div className={cn("flex w-full items-center", big ? "gap-3" : "gap-2")}>
      <span className={cn("tabular-nums text-muted-foreground", big ? "w-12 text-xs" : "w-10 text-[11px]")}>
        {formatDuration(shown)}
      </span>
      <div className="group/slider relative flex-1">
        <Slider
          value={[shown]}
          max={max}
          step={1}
          onValueChange={(v) => setDragging(v[0])}
          onValueCommit={(v) => {
            seek(v[0]);
            setDragging(null);
          }}
          aria-label="Progreso de la canción"
        />
      </div>
      {/* Tiempo total = duración REAL del archivo de audio (audio.duration). */}
      <span
        className={cn("tabular-nums text-muted-foreground", big ? "w-12 text-right text-xs" : "w-10 text-right text-[11px]")}
      >
        {formatDuration(total)}
      </span>
    </div>
  );
}

function LikeCurrent() {
  const current = usePlayer((s) => s.current());
  const toggleLike = useLibrary((s) => s.toggleLike);
  const isLiked = useLibrary((s) => s.likedTracks.some((x) => x.id === (current?.id ?? "")));
  if (!current) return null;
  return (
    <button
      onClick={() => {
        const liked = toggleLike(current);
        toast(liked ? "Añadido a Me gusta" : "Quitado de Me gusta");
      }}
      aria-label={isLiked ? "Quitar de Me gusta" : "Añadir a Me gusta"}
      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
      title={isLiked ? "Quitar de Me gusta" : "Añadir a Me gusta"}
    >
      <Heart className={cn("h-5 w-5", isLiked && "fill-vortex-2 text-vortex-2")} />
    </button>
  );
}

function VolumeControl() {
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const setVolume = usePlayer((s) => s.setVolume);
  const toggleMute = usePlayer((s) => s.toggleMute);
  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleMute}
        aria-label={muted ? "Activar sonido" : "Silenciar"}
        title={muted ? "Activar sonido" : "Silenciar"}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
      >
        <Icon className="h-4 w-4" />
      </button>
      <div className="w-24">
        <Slider
          value={[Math.round(effective * 100)]}
          max={100}
          step={1}
          onValueChange={(v) => setVolume(v[0] / 100)}
          aria-label="Volumen"
        />
      </div>
    </div>
  );
}

export function PlayerBar() {
  const current = usePlayer((s) => s.current());
  const togglePlay = usePlayer((s) => s.togglePlay);
  const next = usePlayer((s) => s.next);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const queueOpen = usePlayer((s) => s.queueOpen);
  const toggleQueue = usePlayer((s) => s.toggleQueue);
  const setNowPlayingOpen = usePlayer((s) => s.setNowPlayingOpen);
  const toggleNowPlaying = usePlayer((s) => s.toggleNowPlaying);
  const { pos, dur } = useAudioProgress();

  if (!current) return null;

  return (
    <>
      {/* Barra de escritorio */}
      <div
        className={cn(
          "relative z-40 hidden h-[84px] grid-cols-[1fr_minmax(0,44%)_1fr] items-center gap-3 border-t border-white/5 bg-[#070c16]/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-[#070c16]/85 sm:grid"
        )}
      >
        {/* Pista actual: tocar aquí vuelve a la pantalla completa */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setNowPlayingOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none ring-vortex focus-visible:ring-2"
            aria-label="Abrir pantalla de reproducción"
            title="Abrir pantalla de reproducción"
          >
            <AlbumArt src={current.artwork} alt={current.title} rounded="rounded-md" className="h-12 w-12 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{current.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{current.artist}</span>
            </span>
          </button>
          <LikeCurrent />
        </div>

        {/* Controles + progreso */}
        <div className="flex flex-col items-center gap-1.5">
          <Controls />
          <ProgressBar />
        </div>

        {/* Extras */}
        <div className="flex items-center justify-end gap-1 sm:gap-2">
          <button
            onClick={toggleQueue}
            aria-label="Cola de reproducción"
            aria-pressed={queueOpen}
            title="Cola de reproducción"
            className={cn(
              "relative flex h-9 w-9 items-center justify-center rounded-full transition-colors",
              queueOpen ? "text-vortex-soft" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ListMusic className="h-5 w-5" />
          </button>
          <VolumeControl />
          <button
            onClick={toggleNowPlaying}
            aria-label="Vista completa"
            title="Vista completa"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mini reproductor móvil */}
      <div className="relative z-40 border-t border-white/5 bg-[#070c16]/97 backdrop-blur sm:hidden">
        <div
          className="absolute left-0 top-0 h-[2px] bg-vortex transition-[width] duration-150"
          style={{ width: dur > 0 ? `${(pos / dur) * 100}%` : "0%" }}
          aria-hidden="true"
        />
        <div className="flex h-[60px] items-center gap-3 px-3">
          <button
            onClick={toggleNowPlaying}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-label="Abrir pantalla de reproducción"
          >
            <AlbumArt src={current.artwork} alt={current.title} rounded="rounded-md" className="h-10 w-10 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{current.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">{current.artist}</p>
            </div>
          </button>
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? "Pausar" : "Reproducir"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full vortex-gradient text-white"
          >
            {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 translate-x-[1px] fill-current" />}
          </button>
          <button
            onClick={() => next()}
            aria-label="Siguiente"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground"
          >
            <SkipForward className="h-5 w-5 fill-current" />
          </button>
        </div>
      </div>
    </>
  );
}

export { Controls, ProgressBar, VolumeControl };
