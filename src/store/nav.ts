"use client";

import { create } from "zustand";

export type View =
  | { type: "home" }
  | { type: "search"; q?: string }
  | { type: "artist"; id: string }
  | { type: "album"; id: string }
  | { type: "genre"; slug: string }
  | { type: "playlist"; id: string }
  | { type: "liked" }
  | { type: "library" };

interface NavState {
  stack: View[];
  index: number;
  push: (v: View) => void;
  replace: (v: View) => void;
  back: () => void;
  forward: () => void;
  goHome: () => void;
}

const INITIAL: View[] = [{ type: "home" }];

export const useNav = create<NavState>((set, get) => ({
  stack: INITIAL,
  index: 0,
  push: (v) => {
    const { stack, index } = get();
    // Evitar duplicar la misma vista consecutiva.
    const current = stack[index];
    if (JSON.stringify(current) === JSON.stringify(v)) return;
    const next = [...stack.slice(0, index + 1), v];
    set({ stack: next, index: next.length - 1 });
  },
  replace: (v) => {
    const { stack, index } = get();
    const next = [...stack.slice(0, index), v];
    set({ stack: next, index: next.length - 1 });
  },
  back: () => set((s) => ({ index: Math.max(0, s.index - 1) })),
  forward: () => set((s) => ({ index: Math.min(s.stack.length - 1, s.index + 1) })),
  goHome: () => get().push({ type: "home" }),
}));

export function viewKey(v: View): string {
  switch (v.type) {
    case "artist":
      return `artist:${v.id}`;
    case "album":
      return `album:${v.id}`;
    case "genre":
      return `genre:${v.slug}`;
    case "playlist":
      return `playlist:${v.id}`;
    case "search":
      return `search:${v.q ?? ""}`;
    default:
      return v.type;
  }
}
