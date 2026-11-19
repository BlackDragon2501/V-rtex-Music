"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { usePlayer } from "@/store/player";
import { useLibrary } from "@/store/library";
// Validación de la URL que llega al <audio>: la pista de Internet Archive debe
// apuntar al archivo MP3 DIRECTO (ruta .mp3); cualquier otra fuente debe ser
// http(s) bien formada. Ante URL inválida, la pista se salta sin romper nada.
import { streamUrlSegura } from "@/lib/music/mp3";

interface PlayerAudioCtx {
  audio: HTMLAudioElement | null;
  seek: (t: number) => void;
  restart: () => void;
}

const PlayerAudioContext = createContext<PlayerAudioCtx>({
  audio: null,
  seek: () => undefined,
  restart: () => undefined,
});

export const usePlayerAudio = () => useContext(PlayerAudioContext);

// Motor de reproducción: elemento <audio> + integración con el store y el SO (Media Session).
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const errorStreak = useRef(0);
  // Caché local de resoluciones: trackId → URL completa ("" = sin versión completa).
  const resolvedRef = useRef<Map<string, string>>(new Map());

  const current = usePlayer((s) =>
    s.index >= 0 && s.index < s.queue.length ? s.queue[s.index] : null
  );
  const isPlaying = usePlayer((s) => s.isPlaying);
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const playToken = usePlayer((s) => s.playToken);
  const repeat = usePlayer((s) => s.repeat);

  // URL del audio de la siguiente pista de la cola (para precargarla).
  const nextStreamUrl = usePlayer((s) => {
    const i = s.index + 1;
    return i >= 0 && i < s.queue.length ? s.queue[i].streamUrl : null;
  });

  const setAudioRef = useCallback((el: HTMLAudioElement | null) => {
    audioRef.current = el;
    setAudio(el);
  }, []);

  // Cambio de pista → cargar la fuente (SOLO si la URL pasa la validación;
  // una URL inválida o no-MP3 de IA se salta con aviso, jamás llega al audio).
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!current) {
      a.removeAttribute("src");
      a.load();
      return;
    }
    if (a.dataset.trackId !== current.id) {
      const urlElegida = current.preview && resolvedRef.current.get(current.id) ? resolvedRef.current.get(current.id)! : current.streamUrl;
      if (!streamUrlSegura(urlElegida, current.source)) {
        console.warn(`[player] streamUrl inválido para "${current.title}" (${current.source}); se salta la pista.`, urlElegida);
        toast.error("Esta pista no tiene un formato compatible. Saltando a la siguiente…");
        a.dataset.trackId = current.id; // evitar revalidar en bucle
        setTimeout(() => usePlayer.getState().next(true), 400);
        return;
      }
      a.dataset.trackId = current.id;
      // Si ya resolvimos una versión COMPLETA para esta pista, usarla directamente;
      // si no, cargar el stream del catálogo y en paralelo buscar la versión
      // completa para intercambiarla en caliente.
      const full = resolvedRef.current.get(current.id);
      a.src = current.preview && full ? full : current.streamUrl;
      a.load();
      errorStreak.current = 0;
    }
  }, [current]);

  // Sustitución automática de avances de 30 s por audio COMPLETO.
  // Al empezar un avance, pedimos al servidor que busque la misma canción a
  // longitud completa (Audius / Jamendo / ccMixter / FMA / Wikimedia). Si la
  // encuentra, se intercambia la fuente manteniendo la posición actual.
  useEffect(() => {
    const a = audioRef.current;
    if (!current || !current.preview) return;
    const trackId = current.id;
    if (resolvedRef.current.has(trackId)) {
      // Ya resuelta antes: si hay URL completa y apenas arrancó, saltar a ella.
      const full = resolvedRef.current.get(trackId);
      if (full && a && a.dataset.trackId === trackId && a.src !== full && a.currentTime < 28) {
        const pos = a.currentTime;
        const wasPlaying = !a.paused;
        a.src = full;
        a.load();
        const onMeta = () => {
          if (pos > 0.2) a.currentTime = pos;
          if (wasPlaying) a.play().catch(() => undefined);
          a.removeEventListener("loadedmetadata", onMeta);
        };
        a.addEventListener("loadedmetadata", onMeta);
      }
      return;
    }
    resolvedRef.current.set(trackId, ""); // marcar "en curso" para no repetir
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 9000);
    const url = `/api/music/resolve?t=${encodeURIComponent(current.title)}&a=${encodeURIComponent(
      current.artist
    )}&d=${Math.round(current.duration)}`;
    fetch(url, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { resolved?: boolean; track?: { streamUrl?: string; duration?: number; source?: string } } | null) => {
        clearTimeout(timer);
        const full = data?.resolved && streamUrlSegura(data.track?.streamUrl ?? "", data.track?.source) ? data.track!.streamUrl! : "";
        resolvedRef.current.set(trackId, full);
        // Aplicar en vivo si seguimos en la misma pista y apenas empezó.
        const cur = usePlayer.getState().current();
        if (
          full &&
          a &&
          cur?.id === trackId &&
          a.dataset.trackId === trackId &&
          a.src !== full &&
          a.currentTime < 28
        ) {
          const pos = a.currentTime;
          const wasPlaying = !a.paused;
          a.src = full;
          a.load();
          const onMeta = () => {
            if (pos > 0.2) a.currentTime = pos;
            if (wasPlaying || usePlayer.getState().isPlaying) a.play().catch(() => undefined);
            a.removeEventListener("loadedmetadata", onMeta);
          };
          a.addEventListener("loadedmetadata", onMeta);
        }
      })
      .catch(() => {
        clearTimeout(timer);
        resolvedRef.current.set(trackId, "");
      });
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [current]);

  // Preresolución de la SIGUIENTE pista si es un avance (transición instantánea a audio completo).
  const nextTrackForResolve = usePlayer((s) => {
    const i = s.index + 1;
    return i >= 0 && i < s.queue.length ? s.queue[i] : null;
  });
  useEffect(() => {
    if (!nextTrackForResolve || !nextTrackForResolve.preview) return;
    const nt = nextTrackForResolve;
    if (resolvedRef.current.has(nt.id)) return;
    resolvedRef.current.set(nt.id, ""); // en curso
    const url = `/api/music/resolve?t=${encodeURIComponent(nt.title)}&a=${encodeURIComponent(
      nt.artist
    )}&d=${Math.round(nt.duration)}`;
    fetch(url, { priority: "low" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { resolved?: boolean; track?: { streamUrl?: string; source?: string } } | null) => {
        resolvedRef.current.set(nt.id, data?.resolved && streamUrlSegura(data.track?.streamUrl ?? "", data.track?.source) ? data.track!.streamUrl! : "");
      })
      .catch(() => resolvedRef.current.set(nt.id, ""));
  }, [nextTrackForResolve]);

  // Play / pausa.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying && current) {
      a.play().catch((e: unknown) => {
        // Política de autoplay: reintentar en cuanto el usuario interactúe.
        if (e instanceof DOMException && e.name === "NotAllowedError") {
          const retry = () => {
            if (usePlayer.getState().isPlaying) {
              a.play().catch(() => undefined);
            }
            window.removeEventListener("pointerdown", retry);
            window.removeEventListener("keydown", retry);
          };
          window.addEventListener("pointerdown", retry);
          window.addEventListener("keydown", retry);
        }
      });
    } else {
      a.pause();
    }
  }, [isPlaying, current, playToken]);

  // Volumen.
  useEffect(() => {
    const a = audioRef.current;
    if (a) {
      a.volume = volume;
      a.muted = muted;
    }
  }, [volume, muted]);

  // Precarga del audio de la SIGUIENTE pista (transiciones instantáneas).
  // Un único elemento auxiliar; al cambiar de pista se libera el anterior.
  // Solo se precargan URLs válidas (http(s), y .mp3 directo si es IA).
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!nextStreamUrl || !streamUrlSegura(nextStreamUrl, usePlayer.getState().queue[usePlayer.getState().index + 1]?.source)) return;
    try {
      const el = new Audio();
      el.preload = "auto";
      el.src = nextStreamUrl;
      preloadRef.current = el;
      return () => {
        el.pause();
        el.removeAttribute("src");
        el.load();
        if (preloadRef.current === el) preloadRef.current = null;
      };
    } catch {
      /* preload no disponible */
    }
  }, [nextStreamUrl]);

  // Historial "Escuchado recientemente".
  useEffect(() => {
    if (current) useLibrary.getState().addRecentlyPlayed(current);
  }, [current]);

  // Fin de pista → repetir 1 o avanzar.
  const handleEnded = useCallback(() => {
    const s = usePlayer.getState();
    if (s.repeat === "one") {
      const a = audioRef.current;
      if (a) {
        a.currentTime = 0;
        a.play().catch(() => undefined);
      }
      return;
    }
    s.next(true);
  }, []);

  // Error de red o de pista.
  const handleError = useCallback(() => {
    const s = usePlayer.getState();
    if (!s.queue.length) return;
    errorStreak.current += 1;
    s.setPlaying(false);
    if (errorStreak.current <= 2 && s.queue.length > 1) {
      toast.error("No se pudo reproducir esta pista. Saltando a la siguiente…");
      setTimeout(() => usePlayer.getState().next(true), 900);
    } else {
      toast.error("No se pudo reproducir la pista. Comprueba tu conexión.");
    }
  }, []);

  // Integración con controles multimedia del sistema (Media Session API).
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator) || !current) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artist,
        album: current.album ?? "Vórtex Music",
        artwork: current.artwork
          ? [{ src: current.artwork, sizes: "600x600", type: "image/jpeg" }]
          : [],
      });
      navigator.mediaSession.setActionHandler("play", () => usePlayer.getState().setPlaying(true));
      navigator.mediaSession.setActionHandler("pause", () => usePlayer.getState().setPlaying(false));
      navigator.mediaSession.setActionHandler("nexttrack", () => usePlayer.getState().next());
      navigator.mediaSession.setActionHandler("previoustrack", () => usePlayer.getState().prev());
    } catch {
      /* Media Session no soportado */
    }
  }, [current]);

  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    } catch {
      /* ignorar */
    }
  }, [isPlaying]);

  const seek = useCallback((t: number) => {
    const a = audioRef.current;
    if (a && isFinite(t)) a.currentTime = Math.max(0, t);
  }, []);

  const restart = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.currentTime = 0;
      a.play().catch(() => undefined);
    }
  }, []);

  return (
    <PlayerAudioContext.Provider value={{ audio, seek, restart }}>
      {children}
      <audio ref={setAudioRef} onEnded={handleEnded} onError={handleError} preload="auto" className="hidden" />
    </PlayerAudioContext.Provider>
  );
}

// Progreso de reproducción para barras y sliders (evita re-render del árbol entero).
export function useAudioProgress() {
  const { audio } = usePlayerAudio();
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    if (!audio) return;
    const onTime = () => setPos(audio.currentTime);
    const onMeta = () => setDur(isFinite(audio.duration) ? audio.duration : 0);
    const onReset = () => setPos(0);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("emptied", onReset);
    onMeta();
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("emptied", onReset);
    };
  }, [audio]);

  return { pos, dur };
}
