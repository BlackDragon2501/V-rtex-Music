"use client";

import { useState } from "react";
import { MoreHorizontal, Pause, Pencil, Play, Shuffle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLibrary } from "@/store/library";
import { usePlayer } from "@/store/player";
import { useNav } from "@/store/nav";
import { ViewHeader, EmptyState } from "@/components/music/ViewHeader";
import { TrackList } from "@/components/music/TrackRow";
import { cnBtn } from "./cnBtn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatLongDuration } from "@/lib/format";

export function PlaylistView({ id }: { id: string }) {
  const playlists = useLibrary((s) => s.playlists);
  const removeTrackFromPlaylist = useLibrary((s) => s.removeTrackFromPlaylist);
  const deletePlaylist = useLibrary((s) => s.deletePlaylist);
  const renamePlaylist = useLibrary((s) => s.renamePlaylist);
  const playQueue = usePlayer((s) => s.playQueue);
  const current = usePlayer((s) => s.current());
  const isPlaying = usePlayer((s) => s.isPlaying);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const shuffle = usePlayer((s) => s.shuffle);
  const push = useNav((s) => s.push);

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  const pl = playlists.find((p) => p.id === id);
  if (!pl) {
    return (
      <EmptyState
        title="Playlist no encontrada"
        message="Puede que la hayas eliminado."
      />
    );
  }

  const tracks = pl.tracks;
  const totalSecs = tracks.reduce((acc, t) => acc + t.duration, 0);
  const thisPlaying = tracks.some((t) => t.id === current?.id);

  const playAll = (start = 0) => {
    if (tracks.length === 0) return;
    playQueue(tracks, start, pl.name);
  };

  return (
    <div className="pb-8">
      <ViewHeader
        kindLabel="Playlist"
        title={pl.name}
        variant="gradient"
        gradientIndex={pl.gradient}
        meta={
          <span className="block space-y-1">
            <span className="block">
              {tracks.length} {tracks.length === 1 ? "canción" : "canciones"}
              {tracks.length > 0 && <> · {formatLongDuration(totalSecs)}</>}
            </span>
            {pl.description && <span className="block text-xs text-white/70">{pl.description}</span>}
          </span>
        }
        actions={
          <>
            <button
              onClick={() => (thisPlaying ? togglePlay() : playAll(0))}
              disabled={tracks.length === 0}
              aria-label={thisPlaying && isPlaying ? "Pausar" : "Reproducir playlist"}
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
              aria-label="Reproducir aleatorio"
              className={cnBtn(shuffle) + (tracks.length === 0 ? " opacity-50" : "")}
            >
              <Shuffle className="h-5 w-5" /> Aleatorio
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Más opciones de la playlist"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 text-white transition-colors hover:bg-white/10"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem
                  onClick={() => {
                    setName(pl.name);
                    setRenaming(true);
                  }}
                >
                  <Pencil className="h-4 w-4" /> Renombrar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    deletePlaylist(pl.id);
                    toast.success("Playlist eliminada");
                    push({ type: "library" });
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Eliminar playlist
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="px-2 pt-4 sm:px-6">
        {tracks.length === 0 ? (
          <EmptyState
            title="Playlist vacía"
            message="Busca canciones y usa el menú de cada pista para añadirlas aquí."
          />
        ) : (
          <TrackList
            tracks={tracks}
            contextTitle={pl.name}
            showIndex
            onRemoveFromPlaylist={(t) => {
              removeTrackFromPlaylist(pl.id, t.id);
              toast.success(`"${t.title}" quitada de la playlist`);
            }}
          />
        )}
      </div>

      <Dialog open={renaming} onOpenChange={(o) => (o ? undefined : setRenaming(false))}>
        <DialogContent className="max-w-sm border-border bg-[#0b1220]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Renombrar playlist</DialogTitle>
          </DialogHeader>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="bg-secondary/60"
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                renamePlaylist(pl.id, name.trim());
                setRenaming(false);
                toast.success("Playlist renombrada");
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              Cancelar
            </Button>
            <Button
              className="vortex-gradient font-bold text-white hover:opacity-90"
              onClick={() => {
                if (name.trim()) {
                  renamePlaylist(pl.id, name.trim());
                  setRenaming(false);
                  toast.success("Playlist renombrada");
                }
              }}
            >
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
