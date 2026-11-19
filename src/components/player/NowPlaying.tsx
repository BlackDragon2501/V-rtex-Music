"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Heart,
  ListEnd,
  ListPlus,
  ListStart,
  MicVocal,
  MoreHorizontal,
  User,
} from "lucide-react";
import { AlbumArt } from "@/components/music/AlbumArt";
import { usePlayer } from "@/store/player";
import { useLibrary } from "@/store/library";
import { useNav } from "@/store/nav";
import { useAddToPlaylist } from "@/store/dialogs";
import { Controls, ProgressBar, VolumeControl } from "./PlayerBar";
import { QueueSheet } from "./QueueSheet";
import { LyricsView } from "./Lyrics";
import { VortexLogo } from "@/components/music/Logo";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// Vista completa de reproducción (estilo pantalla completa de YT Music / Spotify).
// Incluye panel de letra sincronizada alternable con la portada.
export function NowPlaying() {
  const open = usePlayer((s) => s.nowPlayingOpen);
  const setNowPlayingOpen = usePlayer((s) => s.setNowPlayingOpen);
  const current = usePlayer((s) => s.current());
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const isLiked = useLibrary((s) => s.likedTracks.some((x) => x.id === (current?.id ?? "")));
  const toggleLike = useLibrary((s) => s.toggleLike);
  const addToQueue = usePlayer((s) => s.addToQueue);
  const playNextUp = usePlayer((s) => s.playNextUp);
  const push = useNav((s) => s.push);
  const openAddToPlaylist = useAddToPlaylist((s) => s.openFor);
  const [queueSheetOpen, setQueueSheetOpen] = useState(false);
  const [lyricsMode, setLyricsMode] = useState(false);

  const nextTrack = queue[index + 1] ?? null;

  if (!current) {
    return (
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 overflow-hidden bg-[#05070d]"
            role="dialog"
            aria-label="Reproduciendo ahora"
          />
        )}
      </AnimatePresence>
    );
  }

  const canGoArtist = Boolean(current.artistId);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 overflow-hidden bg-[#05070d]"
            role="dialog"
            aria-label="Reproduciendo ahora"
          >
            {/* Fondo con la portada difuminada + degradado Vórtex */}
            {current.artwork && (
              <img
                src={current.artwork}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-125 object-cover opacity-25 blur-3xl"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-[#05070d]/60 via-[#05070d]/80 to-[#05070d]" />
            <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-vortex/20 blur-3xl" />
            <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-vortex-2/20 blur-3xl" />

            <div className="relative flex h-full flex-col">
              {/* Cabecera: solo "Reproduciendo" y el título de la canción */}
              <header className="flex items-center justify-between px-4 py-4 sm:px-8">
                <button
                  onClick={() => setNowPlayingOpen(false)}
                  aria-label="Cerrar pantalla completa"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ChevronDown className="h-6 w-6" />
                </button>
                <div className="min-w-0 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
                    Reproduciendo
                  </p>
                  <p className="mt-0.5 max-w-[220px] truncate text-sm font-semibold text-white sm:max-w-md">
                    {current.title}
                  </p>
                </div>
                <VortexLogo size={28} gid="vgrad-nowplaying" className="opacity-90" />
              </header>

              {/* Portada (con anillos de vórtex) o letra sincronizada */}
              {lyricsMode ? (
                <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 items-stretch px-5 py-2 sm:px-8">
                  <LyricsView />
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-2">
                  <div className="relative aspect-square h-full max-h-[420px] w-auto max-w-full min-h-0">
                    <svg viewBox="0 0 100 100" className="vortex-ring absolute -inset-[6%]" aria-hidden="true">
                      <defs>
                        <linearGradient id="np-ring1" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" style={{ stopColor: "var(--vortex)" }} stopOpacity="0.9" />
                          <stop offset="100%" style={{ stopColor: "var(--vortex-2)" }} stopOpacity="0.2" />
                        </linearGradient>
                      </defs>
                      <circle
                        cx="50" cy="50" r="48" fill="none"
                        stroke="url(#np-ring1)" strokeWidth="0.8"
                        strokeDasharray="30 12 8 12" strokeLinecap="round"
                      />
                    </svg>
                    <svg viewBox="0 0 100 100" className="vortex-ring-reverse absolute -inset-[10%]" aria-hidden="true">
                      <defs>
                        <linearGradient id="np-ring2" x1="1" y1="0" x2="0" y2="1">
                          <stop offset="0%" style={{ stopColor: "var(--vortex-2)" }} stopOpacity="0.7" />
                          <stop offset="100%" style={{ stopColor: "var(--vortex)" }} stopOpacity="0.15" />
                        </linearGradient>
                      </defs>
                      <circle
                        cx="50" cy="50" r="47" fill="none"
                        stroke="url(#np-ring2)" strokeWidth="0.6"
                        strokeDasharray="4 10 26 10" strokeLinecap="round"
                      />
                    </svg>
                    <AlbumArt
                      src={current.artwork}
                      alt={current.title}
                      rounded="rounded-2xl"
                      className="h-full w-full shadow-2xl shadow-black/60"
                    />
                  </div>
                </div>
              )}

              {/* Información y controles */}
              <div className="mx-auto w-full max-w-xl px-6 pb-8 pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-extrabold text-white sm:text-3xl">{current.title}</h2>
                    <p className="mt-1 truncate text-sm text-white/70 sm:text-base">{current.artist}</p>
                    {current.genre && (
                      <span className="mt-2 block text-[11px] font-semibold uppercase tracking-wider text-white/45">
                        {current.genre}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-start gap-0.5">
                    {/* Alternar letra sincronizada */}
                    <button
                      onClick={() => setLyricsMode((v) => !v)}
                      aria-pressed={lyricsMode}
                      aria-label={lyricsMode ? "Ver portada" : "Ver letra sincronizada"}
                      title={lyricsMode ? "Ver portada" : "Letra sincronizada"}
                      className={cn(
                        "mt-2 flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus-visible:outline-none",
                        lyricsMode ? "bg-white/15 text-vortex-soft" : "text-white/80 hover:text-white"
                      )}
                    >
                      <MicVocal className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        const liked = toggleLike(current);
                        toast(liked ? "Añadido a Me gusta" : "Quitado de Me gusta");
                      }}
                      aria-label={isLiked ? "Quitar de Me gusta" : "Añadir a Me gusta"}
                      className="mt-2 flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <Heart className={cn("h-6 w-6", isLiked && "fill-vortex-like text-vortex-like")} />
                    </button>

                    {/* Menú de opciones de la canción (tres puntos, como Spotify) */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          aria-label="Más opciones de la canción"
                          title="Más opciones"
                          className="mt-2 flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none"
                        >
                          <MoreHorizontal className="h-6 w-6" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={8}
                        className="w-64 border-border bg-popover/95 backdrop-blur"
                      >
                        <DropdownMenuItem onClick={() => openAddToPlaylist(current)}>
                          <ListPlus className="h-4 w-4" /> Añadir a una playlist
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            addToQueue(current);
                            toast("Añadido a la cola");
                          }}
                        >
                          <ListEnd className="h-4 w-4" /> Añadir a la cola
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            playNextUp(current);
                            toast("Se reproducirá a continuación");
                          }}
                        >
                          <ListStart className="h-4 w-4" /> Siguiente en la cola
                        </DropdownMenuItem>
                        {canGoArtist && <DropdownMenuSeparator />}
                        {canGoArtist && (
                          <DropdownMenuItem
                            onClick={() => {
                              // Cerrar la pantalla completa y navegar; la música sigue sonando
                              // y el mini-player queda visible en la parte inferior.
                              setNowPlayingOpen(false);
                              push({ type: "artist", id: current.artistId! });
                            }}
                          >
                            <User className="h-4 w-4" /> Ir al artista
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            const liked = toggleLike(current);
                            toast(liked ? "Añadido a Me gusta" : "Quitado de Me gusta");
                          }}
                        >
                          <Heart className={cn("h-4 w-4", isLiked && "fill-vortex-like text-vortex-like")} />
                          {isLiked ? "Quitar de Me gusta" : "Añadir a Me gusta"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="mt-5">
                  <ProgressBar big />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="sm:hidden">
                    <Controls big />
                  </div>
                  <div className="hidden flex-1 justify-center sm:flex">
                    <Controls big />
                  </div>
                  <div className="hidden sm:block">
                    <VolumeControl />
                  </div>
                </div>

                {/* Tarjeta "Siguiente": clicable → bottom sheet con toda la cola */}
                {nextTrack && (
                  <button
                    onClick={() => setQueueSheetOpen(true)}
                    aria-label="Ver toda la cola de reproducción"
                    title="Ver toda la cola"
                    className="group mt-6 flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                        Siguiente
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-white">{nextTrack.title}</p>
                      <p className="truncate text-xs text-white/60">{nextTrack.artist}</p>
                    </div>
                    <ChevronUp
                      className="h-5 w-5 shrink-0 text-white/50 transition-all group-hover:translate-y-[-2px] group-hover:text-white"
                      aria-hidden="true"
                    />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom sheet con toda la cola de reproducción */}
      {current && <QueueSheet open={queueSheetOpen} onOpenChange={setQueueSheetOpen} />}
    </>
  );
}
