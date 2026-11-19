"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Historial de búsqueda reciente, guardado en localStorage.
// · add(q)      → guarda la búsqueda arriba de la lista (máx. 8, sin duplicados)
// · remove(q)   → elimina una búsqueda individual (icono X del dropdown)
// · clearAll()  → botón "Limpiar todo" del dropdown
const MAX_ITEMS = 8;

interface SearchHistoryState {
  items: string[];
  add: (q: string) => void;
  remove: (q: string) => void;
  clearAll: () => void;
}

export const useSearchHistory = create<SearchHistoryState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (q) => {
        const t = q.trim();
        if (t.length < 2) return;
        const rest = get().items.filter((x) => x.toLowerCase() !== t.toLowerCase());
        set({ items: [t, ...rest].slice(0, MAX_ITEMS) });
      },
      remove: (q) =>
        set((s) => ({ items: s.items.filter((x) => x !== q) })),
      clearAll: () => set({ items: [] }),
    }),
    { name: "vortex:search-history", storage: createJSONStorage(() => localStorage) }
  )
);
