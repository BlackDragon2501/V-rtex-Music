"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Modos de color de Vórtex Music:
//   · "azul"      → tema por defecto (azul eléctrico + violeta)
//   · "esmeralda" → modo de colores alternativo (esmeralda + turquesa)
export type VortexTheme = "azul" | "esmeralda";

interface ThemeState {
  theme: VortexTheme;
  setTheme: (t: VortexTheme) => void;
}

export function applyTheme(t: VortexTheme): void {
  if (typeof document === "undefined") return;
  if (t === "esmeralda") {
    document.documentElement.dataset.theme = "esmeralda";
  } else {
    delete document.documentElement.dataset.theme;
  }
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "azul",
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: "vortex-theme",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Al rehidratar, aplicar el atributo data-theme (evita parpadeo entre sesiones).
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    }
  )
);
