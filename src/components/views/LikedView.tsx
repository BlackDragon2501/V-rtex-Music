"use client";

import { Pause, Play, Shuffle } from "lucide-react";
import { useLibrary } from "@/store/library";
import { usePlayer } from "@/store/player";
import { ViewHeader, EmptyState } from "@/components/music/ViewHeader";
import { TrackList } from "@/components/music/TrackRow";
import { cnBtn } from "./cnBtn";
import { formatLongDuration } from "@/lib/format";

export function LikedView() {
  const likedTracks = useLibrary((s) => s.likedTracks);
  const playQueue = usePlayer((s) => s.playQueue);
  const current = usePlayer((s) => s.current());
  const isPlaying = usePlayer((s) => s.isPlaying);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const shuffle = usePlayer((s) => s.shuffle);

  const tracks = likedTracks;
  const totalSecs = tracks.reduce((acc, t) => acc + t.duration, 0);
  const thisPlaying = tracks.some((t) => t.id === current?.id);

  const playAll = (start = 0) => {
    if (tracks.length === 0) return;
    playQueue(tracks, start, "Me gusta");
  };

  return (
    <div className="pb-8">
      <ViewHeader
        kindLabel="Playlist automática"
        title="Me gusta"
        variant="liked"
        meta={
          <span>
            {tracks.length} {tracks.length === 1 ? "canción" : "canciones"}
            {tracks.length > 0 && <> · {formatLongDuration(totalSecs)}</>}
          </span>
        }
        actions={
          <>
            <button
              onClick={() => (thisPlaying ? togglePlay() : playAll(0))}
              disabled={tracks.length === 0}
              aria-label={thisPlaying && isPlaying ? "Pausar" : "Reproducir Me gusta"}
              className="flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-[#0b1220] transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            >
              {thisPlaying && isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
              Reproducir
            </button>
            <button
              onClick={() => {
                if (!shuffle) toggleShuffle();
                playAll(Math.floor(Math.random() * Math.max(1, tracks.length)));
              }}
              disabled={tracks.length === 0}
              className={cnBtn(shuffle) + (tracks.length === 0 ? " opacity-50" : "")}
            >
              <Shuffle className="h-5 w-5" /> Aleatorio
            </button>
          </>
        }
      />
      <div className="px-2 pt-4 sm:px-6">
        {tracks.length === 0 ? (
          <EmptyState
            title="Todavía no hay canciones"
            message="Pulsa el corazón en cualquier canción para guardarla aquí."
          />
        ) : (
          <TrackList tracks={tracks} contextTitle="Me gusta" showIndex />
        )}
      </div>
    </div>
  );
}
