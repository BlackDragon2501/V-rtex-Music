"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

// Carga asíncrona basada en TanStack Query con estados de carga/error y reintento.
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const queryClient = useQueryClient();
  const queryKey = deps.length > 0 ? ["music", ...deps] : ["music", "home"];

  const query = useQuery<T>({
    queryKey,
    queryFn: fn,
    // El catálogo no cambia con frecuencia: 5 min fresco + respaldo en caché
    // hace que volver atrás o reabrir una vista sea instantáneo.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    data: query.data ?? null,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    reload: () => queryClient.invalidateQueries({ queryKey }),
  };
}
