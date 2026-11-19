"use client";

import { useMemo } from "react";
import { Play, Pause, Sparkles, Rocket } from "lucide-react";
import { api, nextVisit } from "@/lib/api-client";
import { useAsync } from "@/hooks/use-async";
import { Section, CarouselItem } from "@/components/music/Section";
import { MediaCard } from "@/components/music/MediaCard";
import { AlbumArt } from "@/components/music/AlbumArt";
import { VortexLogo } from "@/components/music/Logo";
import { ErrorState, CardsSkeleton, RowsSkeleton } from "@/components/music/ViewHeader";
import { usePlayer } from "@/store/player";
import { useLibrary } from "@/store/library";
import { useNav } from "@/store/nav";
import { useMounted } from "@/hooks/use-mounted";
import { GENRES } from "@/lib/music/genres";
import { cn } from "@/lib/utils";
import { GENRE_GRADIENTS } from "@/lib/format";
import type { Track } from "@/lib/music/types";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function TrackCards({ tracks, contextTitle }: { tracks: Track[]; contextTitle: string }) {
  const currentId = usePlayer((s) => (s.index >= 0 && s.index < s.queue.length ? s.queue[s.index]?.id : null));
  const playQueue = usePlayer((s) => s.playQueue);
  return (
    <>
      {tracks.map((t, i) => (
        <CarouselItem key={`${t.id}-${i}`}>
          <MediaCard
            kind="track"
            title={t.title}
            subtitle={t.artist}
            artwork={t.artwork}
            active={currentId === t.id}
            onOpen={() => playQueue(tracks, i, contextTitle)}
            onPlay={() => playQueue(tracks, i, contextTitle)}
          />
        </CarouselItem>
      ))}
    </>
  );
}

export function HomeView() {
  // Cada montaje = una visita nueva: nonce en la clave de React Query para que
  // la rotación del servidor traiga canciones distintas en cada entrada.
  const visit = useMemo(() => nextVisit(), []);
  const { data, loading, error, reload } = useAsync(() => api.home(), [visit]);
  const playQueue = usePlayer((s) => s.playQueue);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const current = usePlayer((s) => s.current());
  const recentlyPlayed = useLibrary((s) => s.recentlyPlayed);
  const push = useNav((s) => s.push);
  const mounted = useMounted();
  const saludo = mounted ? greeting() : "Buenas noches";

  if (error) return <ErrorState onRetry={reload} message={error} />;
  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <div className="mb-8 h-44 w-full animate-pulse rounded-2xl bg-secondary/70" />
        <RowsSkeleton count={3} />
        <div className="mt-10">
          <CardsSkeleton count={6} />
        </div>
      </div>
    );
  }
  if (!data) return null;

  const trending = data.trending;
  const heroTrack = trending[0];

  return (
    <div className="px-4 pb-8 pt-4 sm:px-6">
      {/* Portada */}
      <div className="vortex-gradient relative mb-8 overflow-hidden rounded-2xl p-6 sm:p-8">
        <VortexLogo size={220} gid="vgrad-hero" className="vortex-ring absolute -right-10 -top-10 opacity-20" />
        <div className="relative max-w-xl">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/80">
            <Sparkles className="h-3.5 w-3.5" /> {saludo}
          </p>
          <h1 className="mt-2 text-2xl font-black leading-tight text-white sm:text-4xl">
            Tu música, sin límites.
          </h1>
          <p className="mt-2 text-sm text-white/85 sm:text-base">
            Música online 100% legal, completa y gratis, sin un solo anuncio.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => heroTrack && playQueue(trending, 0, "Tendencias Vórtex")}
              disabled={!heroTrack}
              className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#0b1220] transition-transform hover:scale-105 disabled:opacity-60"
            >
              <Play className="h-4 w-4 fill-current" /> Reproducir tendencias
            </button>
            <button
              onClick={() => push({ type: "genre", slug: "reggaeton" })}
              className="flex items-center gap-2 rounded-full border border-white/40 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10"
            >
              <Rocket className="h-4 w-4" /> Explorar géneros
            </button>
          </div>
        </div>
      </div>

      {/* Accesos rápidos (primeras tendencias) */}
      {trending.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {trending.slice(0, 8).map((t, i) => {
            const active = current?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => playQueue(trending, i, "Tendencias Vórtex")}
                className={cn(
                  "group flex items-center gap-3 overflow-hidden rounded-lg bg-secondary/60 pr-2 text-left transition-colors hover:bg-secondary",
                  active && "bg-secondary"
                )}
                aria-label={`Reproducir ${t.title} de ${t.artist}`}
              >
                <AlbumArt src={t.artwork} alt={t.title} rounded="rounded-none" className="h-14 w-14 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.title}</span>
                <span className="vortex-gradient flex h-9 w-9 shrink-0 translate-x-1 items-center justify-center rounded-full text-white opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
                  {active && isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 translate-x-[1px] fill-current" />}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {mounted && recentlyPlayed.length > 0 && (
        <Section title="Escuchado recientemente">
          <TrackCards tracks={recentlyPlayed} contextTitle="Escuchado recientemente" />
        </Section>
      )}

      {trending.length > 0 && (
        <Section title="Tendencias Vórtex" subtitle="Lo más sonado ahora en Audius · canciones completas">
          <TrackCards tracks={trending} contextTitle="Tendencias Vórtex" />
        </Section>
      )}

      {data.fresh.length > 0 && (
        <Section
          title="Novedades libres"
          subtitle="Selección destacada de ccMixter · canciones completas"
        >
          <TrackCards tracks={data.fresh} contextTitle="Novedades libres · ccMixter" />
        </Section>
      )}

      {/* Radios por género */}
      <Section title="Radios por género" subtitle="Elige tu estilo y dale al play" carousel={false}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Object.entries(GENRES).map(([slug, g], i) => (
            <button
              key={slug}
              onClick={() => push({ type: "genre", slug })}
              className="group relative flex h-24 items-end overflow-hidden rounded-xl p-4 text-left transition-transform hover:scale-[1.02]"
              style={{ backgroundImage: GENRE_GRADIENTS[i % GENRE_GRADIENTS.length] }}
              aria-label={`Radio de ${g.label}`}
            >
              <span className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <span className="relative text-base font-extrabold text-white">{g.label}</span>
              <span className="vortex-gradient absolute bottom-3 right-3 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full text-white opacity-0 shadow-xl transition-all group-hover:translate-y-0 group-hover:opacity-100">
                <Play className="h-4 w-4 fill-current" />
              </span>
            </button>
          ))}
        </div>
      </Section>

      {data.world.length > 0 && (
        <Section
          title="Rincón del mundo"
          subtitle="Rusia y China tradicionales · dominio público y CC, completas"
        >
          <TrackCards tracks={data.world} contextTitle="Rincón del mundo" />
        </Section>
      )}

      {data.ccTracks.length > 0 && (
        <Section
          title="Sonidos libres"
          subtitle="Canciones completas de Jamendo y Wikimedia Commons"
        >
          <TrackCards tracks={data.ccTracks} contextTitle="Sonidos libres · Creative Commons" />
        </Section>
      )}

      {data.underground.length > 0 && (
        <Section title="Underground" subtitle="Descubre joyas ocultas de artistas independientes">
          <TrackCards tracks={data.underground} contextTitle="Underground Audius" />
        </Section>
      )}
    </div>
  );
}
