"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => undefined;

// true solo en el cliente tras la hidratación. Evita desajustes de SSR
// con estado restaurado de localStorage (zustand persist) o datos locales.
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
