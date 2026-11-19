"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Track } from "@/lib/music/types";

export type RepeatMode = "off" | "all" | "one";

interface PlayerState {
  queue: Track[];
  index: number; // -1 = sin pista actual
  playToken: number; // incrementa al cambiar de pista para forzar recarga del audio
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number; // 0..1
  muted: boolean;
  queueOpen: boolean;
  nowPlayingOpen: boolean;
  contextTitle: string; // "Reproduciendo desde …"
  history: number[]; // índices reproducidos (para prev con shuffle)

  // --- derivado ---
  current: () => Track | null;

  // --- acciones ---
  playQueue: (tracks: Track[], startIndex?: number, contextTitle?: string) => void;
  playTrackNow: (t: Track, contextTitle?: string) => void;
  playPlaylistAt: (i: number) => void;
  togglePlay: () => void;
  setPlaying: (p: boolean) => void;
  next: (auto?: boolean) => void;
  prev: () => void;
  addToQueue: (t: Track) => void;
  addManyToQueue: (ts: Track[]) => void;
  playNextUp: (t: Track) => void;
  removeFromQueue: (i: number) => void;
  clearQueue: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleQueue: () => void;
  setQueueOpen: (open: boolean) => void;
  toggleNowPlaying: () => void;
  setNowPlayingOpen: (open: boolean) => void;
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      index: -1,
      playToken: 0,
      isPlaying: false,
      shuffle: false,
      repeat: "off",
      volume: 0.85,
      muted: false,
      queueOpen: false,
      nowPlayingOpen: false,
      contextTitle: "",
      history: [],

      current: () => {
        const s = get();
        return s.index >= 0 && s.index < s.queue.length ? s.queue[s.index] : null;
      },

      playQueue: (tracks, startIndex = 0, contextTitle = "Vórtex Music") => {
        if (tracks.length === 0) return;
        const s = get();
        const target = Math.max(0, Math.min(startIndex, tracks.length - 1));
        // Si ya suena la misma pista pedida, alternar play/pausa (comportamiento Spotify).
        const current = s.current();
        if (current && current.id === tracks[target].id) {
          set({ isPlaying: !s.isPlaying });
          return;
        }
        set({
          queue: tracks,
          index: target,
          contextTitle,
          playToken: s.playToken + 1,
          isPlaying: true,
          history: [],
        });
      },

      playTrackNow: (t, contextTitle = "Vórtex Music") => {
        const s = get();
        const current = s.current();
        if (current && current.id === t.id) {
          set({ isPlaying: !s.isPlaying });
          return;
        }
        // Inserta tras la pista actual y reproduce (comportamiento "reproducir ahora").
        const rest = s.queue.slice(s.index + 1);
        set({
          queue: current ? [current, t, ...rest] : [t],
          index: current ? s.index + 1 : 0,
          contextTitle,
          playToken: s.playToken + 1,
          isPlaying: true,
        });
      },

      playPlaylistAt: (i) => {
        const s = get();
        const t = s.queue[i];
        if (!t) return;
        if (i === s.index) {
          set({ isPlaying: !s.isPlaying });
          return;
        }
        set({
          index: i,
          playToken: s.playToken + 1,
          isPlaying: true,
          history: [...s.history, s.index].slice(-50),
        });
      },

      togglePlay: () => {
        const s = get();
        if (s.queue.length === 0) return;
        set({ isPlaying: !s.isPlaying });
      },

      setPlaying: (p) => set({ isPlaying: p }),

      next: (auto = false) => {
        const s = get();
        if (s.queue.length === 0) return;
        let nextIndex: number;
        if (s.shuffle && s.queue.length > 1) {
          do {
            nextIndex = Math.floor(Math.random() * s.queue.length);
          } while (nextIndex === s.index);
        } else if (s.index + 1 < s.queue.length) {
          nextIndex = s.index + 1;
        } else {
          // fin de la cola
          if (s.repeat === "all") nextIndex = 0;
          else {
            set({ isPlaying: false });
            return;
          }
        }
        set({
          index: nextIndex,
          playToken: s.playToken + 1,
          isPlaying: true,
          history: auto ? [...s.history, s.index].slice(-50) : s.history,
        });
      },

      prev: () => {
        const s = get();
        if (s.queue.length === 0) return;
        if (s.history.length > 0) {
          const h = [...s.history];
          const prevIndex = h.pop()!;
          set({ index: prevIndex, playToken: s.playToken + 1, isPlaying: true, history: h });
          return;
        }
        if (s.index - 1 >= 0) {
          set({ index: s.index - 1, playToken: s.playToken + 1, isPlaying: true });
        } else if (s.repeat === "all") {
          set({ index: s.queue.length - 1, playToken: s.playToken + 1, isPlaying: true });
        }
        // si no hay nada atrás, el proveedor reinicia el tiempo de la pista actual
      },

      addToQueue: (t) =>
        set((s) => ({ queue: [...s.queue, t] })),

      addManyToQueue: (ts) =>
        set((s) => ({ queue: [...s.queue, ...ts] })),

      playNextUp: (t) =>
        set((s) => {
          const q = [...s.queue];
          q.splice(s.index + 1, 0, t);
          return { queue: q };
        }),

      removeFromQueue: (i) =>
        set((s) => {
          if (i === s.index || i < 0 || i >= s.queue.length) return {};
          const q = s.queue.filter((_, idx) => idx !== i);
          const newIndex = i < s.index ? s.index - 1 : s.index;
          return { queue: q, index: newIndex };
        }),

      clearQueue: () => {
        const s = get();
        const cur = s.current();
        set({ queue: cur ? [cur] : [], index: cur ? 0 : -1, history: [] });
      },

      toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),

      cycleRepeat: () =>
        set((s) => ({
          repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off",
        })),

      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)), muted: false }),

      toggleMute: () => set((s) => ({ muted: !s.muted })),

      toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),
      setQueueOpen: (open) => set({ queueOpen: open }),
      toggleNowPlaying: () => set((s) => ({ nowPlayingOpen: !s.nowPlayingOpen })),
      setNowPlayingOpen: (open) => set({ nowPlayingOpen: open }),
    }),
    {
      name: "vortex-player",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({
        queue: s.queue,
        index: s.index,
        shuffle: s.shuffle,
        repeat: s.repeat,
        volume: s.volume,
        muted: s.muted,
        contextTitle: s.contextTitle,
      }),
    }
  )
);
