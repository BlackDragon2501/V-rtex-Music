"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play, Plus, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { api, nextVisit } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import { usePlayer } from "@/store/player";
import { BackButton } from "@/components/music/BackButton";
import { ErrorState, RowsSkeleton } from "@/components/music/ViewHeader";
import { TrackList } from "@/components/music/TrackRow";
import { VortexLogo } from "@/components/music/Logo";
import type { Track } from "@/lib/music/types";

export function GenreView({ slug }: { slug: string }) {
  // Cada montaje = una visita nueva: nonce en la clave de React Query para que
  // la radio rote canciones en cada entrada (sin repetir dentro de la sesión).
  const visit = useMemo(() => nextVisit(), []);
  const { data, loading, error, reload } = useAsync(() => api.genre(slug), [slug, visit]);

  // "Más canciones": tandas adicionales servidas al momento con el MISMO sid
  // de sesión, así el servidor sigue evitando lo ya mostrado a esta sesión y
  // el cliente además envía los ids visibles (exclude) para que la nueva tanda
  // no repita NINGUNA pista en pantalla.
  const [extra, setExtra] = useState<Track[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const moreRef = useRef<HTMLElement | null>(null);
  const pendingScroll = useRef(false);

  // Al cambiar de radio se descartan las tandas extra de la radio anterior.
  useEffect(() => {
    setExtra([]);
    pendingScroll.current = false;
  }, [slug]);

  // Tras añadir una tanda, la vista se desplaza suavemente hasta su inicio.
  useEffect(() => {
    if (pendingScroll.current && extra.length > 0) {
      pendingScroll.current = false;
      moreRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [extra]);

  const playQueue = usePlayer((s) => s.playQueue);
  const current = usePlayer((s) => s.current());
  const isPlaying = usePlayer((s) => s.isPlaying);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const shuffle = usePlayer((s) => s.shuffle);

  // Lista completa (primera tanda + extras) sin duplicados por id.
  const merged = useMemo(() => {
    const seen = new Set<string>();
    const out: Track[] = [];
    for (const t of [...(data?.tracks ?? []), ...extra]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
    return out;
  }, [data, extra]);

  if (error) return <ErrorState onRetry={reload} message={error} />;
  if (loading) {
    return (
      <div className="px-4 py-4 sm:px-6">
        {/* Retroceso disponible también mientras la radio carga */}
        <div className="mb-4">
          <BackButton tone="plain" />
        </div>
        <RowsSkeleton count={5} />
      </div>
    );
  }
  if (!data) return null;

  const base = data.tracks;
  const tracks = merged;
  const thisPlaying = tracks.some((t) => t.id === current?.id);
  const context = `Radio ${data.label}`;

  const playAll = (start = 0) => {
    if (tracks.length === 0) return;
    playQueue(tracks, start, context);
  };

  // Pide otra tanda al momento: el servidor rota por sid (registro en memoria)
  // y el cliente anexa solo las canciones que no están ya en pantalla. La cola
  // de reproducción crece con la radio, así la música nunca se queda sin
  // material nuevo que seguir sonando.
  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const exclude = tracks.map((t) => t.id).slice(-200).join(",");
      const res = await api.genre(slug, exclude);
      const known = new Set(tracks.map((t) => t.id));
      const fresh = res.tracks.filter((t) => !known.has(t.id));
      if (fresh.length === 0) {
        toast("Ya escuchaste toda la radio por ahora", {
          description: "El catálogo rota cada 15 minutos: vuelve más tarde para canciones nuevas.",
        });
      } else {
        setExtra((prev) => [...prev, ...fresh]);
        pendingScroll.current = true;
        // Si esta radio es lo que está sonando, la cola activa también crece:
        // al terminar la tanda previa sigue con las canciones nuevas.
        const st = usePlayer.getState();
        if (st.contextTitle === context) {
          const qIds = new Set(st.queue.map((q) => q.id));
          const toQueue = fresh.filter((t) => !qIds.has(t.id));
          if (toQueue.length > 0) st.addManyToQueue(toQueue);
        }
        toast.success(`+${fresh.length} canciones nuevas en la radio`);
      }
    } catch {
      toast.error("No se pudieron cargar más canciones");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="pb-8">
      {/* Cabecera de radio con degradado */}
      <div className="vortex-gradient relative overflow-hidden px-6 pb-8 pt-14 sm:px-8 sm:pt-20">
        {/* Botón atrás (←): vuelve a la pantalla anterior sin cortar la música */}
        <BackButton className="absolute left-3 top-3 z-10 sm:left-5 sm:top-4" />
        <VortexLogo size={180} gid="vgrad-genre" className="vortex-ring-reverse absolute -right-6 -top-6 opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070d] to-transparent" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">Radio Vórtex</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">{data.label}</h1>
          <p className="mt-2 text-sm text-white/80">
            {tracks.length} canciones seleccionadas para ti · audio completo y legal
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => (thisPlaying ? togglePlay() : playAll(0))}
              className="flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-[#0b1220] transition-transform hover:scale-105"
            >
              {thisPlaying && isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
              Reproducir
            </button>
            <button
              onClick={() => {
                if (!shuffle) toggleShuffle();
                playAll(Math.floor(Math.random() * Math.max(1, tracks.length)));
              }}
              className="flex h-12 items-center gap-2 rounded-full border border-white/30 px-5 text-sm font-bold text-white transition-colors hover:bg-white/10"
            >
              <Shuffle className="h-5 w-5" /> Aleatorio
            </button>
          </div>
        </div>
      </div>

      {base.length > 0 && (
        <section className="px-2 pt-6 sm:px-6">
          <h2 className="mb-3 px-1 text-lg font-bold sm:px-2">Canciones de la radio</h2>
          <TrackList tracks={base} contextTitle={context} showIndex showAlbum playContext={tracks} />
        </section>
      )}

      {/* Tandas pedidas con "Más canciones": numeración continua y misma cola */}
      {extra.length > 0 && (
        <section ref={moreRef} className="scroll-mt-20 px-2 pt-6 sm:px-6">
          <h2 className="mb-3 px-1 text-lg font-bold sm:px-2">Más canciones</h2>
          <TrackList tracks={extra} contextTitle={context} showIndex showAlbum startIndex={base.length} playContext={tracks} />
        </section>
      )}

      {tracks.length > 0 && (
        <div className="flex justify-center px-2 py-8 sm:px-6">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex h-11 items-center gap-2 rounded-full border border-border bg-secondary/50 px-6 text-sm font-bold transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {loadingMore ? "Cargando…" : "Más canciones"}
          </button>
        </div>
      )}
    </div>
  );
}
