"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MicVocal } from "lucide-react";
import { usePlayer } from "@/store/player";
import { useAudioProgress, usePlayerAudio } from "./PlayerProvider";
import { cn } from "@/lib/utils";

// Panel de letra sincronizada estilo Apple Music: la línea activa se resalta
// y el texto se desplaza solo con la reproducción. Tocar una línea salta a ese
// momento de la canción. Si no hay sincronizada, muestra la letra simple.

interface LyricLine {
  t: number;
  text: string;
}

interface LyricsData {
  synced: boolean;
  lines: LyricLine[];
  plain: string;
  provider: string;
}

const clientCache = new Map<string, LyricsData | null>();

function useLyrics(enabled: boolean) {
  const current = usePlayer((s) => s.current());
  const trackKey = current ? `${current.id}|${current.title}|${current.artist}` : "";
  // Datos guardados junto a la clave de su pista: si no coinciden con la
  // canción actual, la letra todavía está cargando (evita mostrar la letra
  // de la pista anterior durante la carga).
  const [loaded, setLoaded] = useState<{ k: string; d: LyricsData | null } | null>(null);

  useEffect(() => {
    if (!enabled || !current) return;
    const k = trackKey;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 10000);
    const load = clientCache.has(k)
      ? Promise.resolve(clientCache.get(k)!)
      : fetch(
          `/api/music/lyrics?t=${encodeURIComponent(current.title)}&a=${encodeURIComponent(
            current.artist
          )}&d=${Math.round(current.duration)}`,
          { signal: ctl.signal }
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((d: LyricsData | null) => {
            clientCache.set(k, d);
            return d;
          });
    load
      .then((d) => setLoaded({ k, d }))
      .catch(() => setLoaded({ k, d: null }))
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [enabled, trackKey, current]);

  const fresh = loaded && loaded.k === trackKey ? loaded.d : undefined;
  return {
    data: fresh,
    loading: fresh === undefined,
    key: fresh !== undefined ? trackKey : "",
  };
}

export function LyricsView() {
  const { seek } = usePlayerAudio();
  const { pos } = useAudioProgress();
  const { data, loading } = useLyrics(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLElement>>(new Map());
  const userScrollUntil = useRef(0);

  const lines = useMemo(() => (data?.synced ? data.lines : []), [data]);

  // Línea activa según el tiempo real del audio (audio.currentTime), derivada
  // de la posición: no necesita estado ni efectos con setState.
  const active = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].t <= pos + 0.25) idx = i;
      else break;
    }
    return idx;
  }, [lines, pos]);

  // Autoscroll centrado en la línea activa (se pausa 5 s si el usuario hace scroll).
  useEffect(() => {
    if (active < 0) return;
    if (Date.now() < userScrollUntil.current) return;
    const el = lineRefs.current.get(active);
    const c = containerRef.current;
    if (el && c) {
      c.scrollTo({
        top: el.offsetTop - c.clientHeight / 2 + el.clientHeight / 2,
        behavior: "smooth",
      });
    }
  }, [active]);

  if (loading) {
    return (
      <div className="flex h-full w-full flex-col justify-center gap-4 py-8" aria-hidden="true">
        {[76, 62, 84, 55, 70, 66].map((w, i) => (
          <div key={i} className="h-5 animate-pulse rounded-full bg-white/10" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }

  if (!data || (!data.synced && !data.plain)) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
        <MicVocal className="h-8 w-8 text-white/30" aria-hidden="true" />
        <p className="text-sm font-semibold text-white/70">Sin letra disponible</p>
        <p className="max-w-xs text-xs text-white/45">
          No encontramos la letra de esta canción en el catálogo abierto.
        </p>
      </div>
    );
  }

  // Letra simple (sin sincronización): texto plano desplazable.
  if (!data.synced) {
    return (
      <div
        ref={containerRef}
        className="scrollbar-thin relative h-full w-full overflow-y-auto pr-2"
        aria-label="Letra de la canción"
      >
        <p className="whitespace-pre-wrap py-10 text-lg font-semibold leading-relaxed text-white/75">
          {data.plain}
        </p>
      </div>
    );
  }

  // Letra sincronizada.
  return (
    <div
      ref={containerRef}
      className="scrollbar-thin relative h-full w-full overflow-y-auto"
      aria-label="Letra sincronizada"
      onWheel={() => {
        userScrollUntil.current = Date.now() + 5000;
      }}
      onTouchStart={() => {
        userScrollUntil.current = Date.now() + 5000;
      }}
    >
      {/* Desvanecidos superior e inferior */}
      <div className="pointer-events-none sticky top-0 h-8 w-full bg-gradient-to-b from-[#05070d] to-transparent" aria-hidden="true" />
      <div className="flex flex-col gap-3.5 pb-16 pl-1">
        {lines.map((l, i) => {
          const isActive = i === active;
          return (
            <button
              key={`${i}-${l.t}`}
              ref={(el) => {
                if (el) lineRefs.current.set(i, el);
                else lineRefs.current.delete(i);
              }}
              onClick={() => seek(l.t)}
              aria-current={isActive || undefined}
              title={isActive ? "Línea actual · toca para saltar aquí" : `Saltar a ${l.t.toFixed(0)}s`}
              className={cn(
                "text-left transition-all duration-300 focus:outline-none",
                l.text ? "leading-snug" : "leading-none",
                isActive
                  ? "scale-[1.02] text-xl font-extrabold text-white sm:text-2xl"
                  : "text-base font-semibold text-white/40 hover:text-white/75 sm:text-lg"
              )}
            >
              {l.text || <span className="text-white/35">♪</span>}
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none sticky bottom-0 h-10 w-full bg-gradient-to-t from-[#05070d] to-transparent" aria-hidden="true" />
    </div>
  );
}
