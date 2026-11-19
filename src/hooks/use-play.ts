"use client";

import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { iaBrowserArtistDetail } from "@/lib/music/ia-browser";
import { usePlayer } from "@/store/player";

// Helpers de reproducción con carga bajo demanda (artista) y modo aleatorio.
export function usePlay() {
  const playQueue = usePlayer((s) => s.playQueue);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);

  const playArtistTop = (id: string, name: string, start = 0) => {
    // Artistas de Internet Archive: carga client-side (creador de IA).
    const detail = id.startsWith("ia-") ? iaBrowserArtistDetail(id) : api.artist(id);
    detail
      .then((d) => {
        if (d.topSongs.length === 0) {
          toast.info("Sin canciones disponibles de este artista");
          return;
        }
        playQueue(d.topSongs, start, `Populares · ${name}`);
      })
      .catch(() => toast.error("No se pudo cargar el artista"));
  };

  const playRandom = (tracks: { length: number }[], contextTitle: string, play: (start: number) => void) => {
    if (tracks.length === 0) return;
    if (!usePlayer.getState().shuffle) toggleShuffle();
    play(Math.floor(Math.random() * tracks.length));
  };

  return { playArtistTop, playRandom };
}
