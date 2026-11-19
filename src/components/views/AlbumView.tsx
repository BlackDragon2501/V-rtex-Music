"use client";

import { Pause, Play, Shuffle, Clock3, User, FileAudio } from "lucide-react";
import { iaBrowserAlbumDetail } from "@/lib/music/ia-browser";
import { NO_MP3_MESSAGE, isNoMp3Error } from "@/lib/music/mp3";
import { useAsync } from "@/hooks/use-async";
import { usePlayer } from "@/store/player";
import { useNav } from "@/store/nav";
import { ViewHeader, ErrorState, EmptyState, RowsSkeleton } from "@/components/music/ViewHeader";
import { TrackList } from "@/components/music/TrackRow";
import { cnBtn } from "./cnBtn";

// Vista de disco completo (Internet Archive: un objeto IA = un álbum).
// Muestra la portada, el artista con acceso a su perfil y TODAS las pistas
// en orden natural de disco (1, 2, 3…; las sin número al final).
export function AlbumView({ id }: { id: string }) {
  const { data, loading, error, reload } = useAsync(() => iaBrowserAlbumDetail(id), [id]);
  const playQueue = usePlayer((s) => s.playQueue);
  const current = usePlayer((s) => s.current());
  const isPlaying = usePlayer((s) => s.isPlaying);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const shuffle = usePlayer((s) => s.shuffle);
  const push = useNav((s) => s.push);

  // Álbum sin ni un solo .mp3 → mensaje claro y específico (NO "Algo salió
  // mal"): Vórtex reproduce MP3 para garantizar compatibilidad total.
  if (error && isNoMp3Error(error)) {
    return (
      <EmptyState
        title={NO_MP3_MESSAGE}
        message="Vórtex Music reproduce MP3 para asegurar compatibilidad en todos los navegadores. Este disco solo trae formatos como FLAC, WAV u OGG (o imágenes y documentos), o sus derivados MP3 aún no están disponibles en Internet Archive. Prueba con otro álbum mientras tanto."
        icon={<FileAudio className="h-7 w-7" />}
      />
    );
  }
  if (error) return <ErrorState onRetry={reload} message={error} />;
  if (loading || !data) {
    return (
      <div className="px-4 py-4 sm:px-6">
        <RowsSkeleton count={8} />
      </div>
    );
  }

  const { album, tracks } = data;
  const totalSecs = tracks.reduce((acc, t) => acc + (t.duration > 0 ? t.duration : 0), 0);
  const totalMin = Math.round(totalSecs / 60);
  const thisAlbumPlaying = tracks.some((t) => t.id === current?.id);

  const playAll = (start = 0) => {
    if (tracks.length === 0) return;
    playQueue(tracks, start, `Álbum · ${album.title}`);
  };

  return (
    <div className="pb-8">
      <ViewHeader
        kindLabel="Álbum"
        title={album.title}
        artwork={album.artwork}
        meta={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              onClick={() => album.artistId && push({ type: "artist", id: album.artistId })}
              className="inline-flex items-center gap-1 font-bold text-white underline-offset-2 hover:underline"
              aria-label={`Ir al artista ${album.artist}`}
            >
              <User className="h-3.5 w-3.5" /> {album.artist}
            </button>
            <span className="text-white/50">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {tracks.length} {tracks.length === 1 ? "canción" : "canciones"}
              {totalMin > 0 ? ` · ${totalMin} min` : ""}
            </span>
            {album.year && (
              <>
                <span className="text-white/50">·</span>
                <span>{album.year}</span>
              </>
            )}
            <span className="text-white/50">·</span>
            <span>{album.source === "archive" ? "Internet Archive" : "Catálogo libre"}</span>
          </span>
        }
        actions={
          <>
            <button
              onClick={() => (thisAlbumPlaying ? togglePlay() : playAll(0))}
              aria-label={thisAlbumPlaying && isPlaying ? "Pausar" : "Reproducir"}
              className="flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-[#0b1220] transition-transform hover:scale-105"
            >
              {thisAlbumPlaying && isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current" />
              )}
              Reproducir
            </button>
            <button
              onClick={() => {
                if (!shuffle) toggleShuffle();
                playAll(Math.floor(Math.random() * Math.max(1, tracks.length)));
              }}
              aria-label="Reproducir aleatorio"
              className={cnBtn(shuffle)}
            >
              <Shuffle className="h-5 w-5" /> Aleatorio
            </button>
          </>
        }
      />

      <section className="px-2 pt-6 sm:px-6">
        <TrackList
          tracks={tracks}
          contextTitle={`Álbum · ${album.title}`}
          showIndex
        />
      </section>
    </div>
  );
}
