"use client";

import { useState } from "react";
import { Check, ListPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAddToPlaylist } from "@/store/dialogs";
import { useLibrary } from "@/store/library";
import { PLAYLIST_GRADIENTS } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AddToPlaylistDialog() {
  const open = useAddToPlaylist((s) => s.open);
  const close = useAddToPlaylist((s) => s.close);
  const track = useAddToPlaylist((s) => s.track);
  const playlists = useLibrary((s) => s.playlists);
  const addTrackToPlaylist = useLibrary((s) => s.addTrackToPlaylist);
  const createPlaylist = useLibrary((s) => s.createPlaylist);
  const [newName, setNewName] = useState("");

  const handleAdd = (id: string, name: string) => {
    if (!track) return;
    const result = addTrackToPlaylist(id, track);
    if (result === "exists") {
      toast.info(`"${track.title}" ya está en ${name}`);
    } else {
      toast.success(`Añadida a ${name}`);
    }
    close();
  };

  const handleCreate = () => {
    if (!track) return;
    const name = newName.trim() || `Playlist ${(playlists.length ?? 0) + 1}`;
    const pl = createPlaylist(name, [track]);
    setNewName("");
    toast.success(`Playlist "${pl.name}" creada con la canción`);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : close())}>
      <DialogContent className="max-w-md border-border bg-[#0b1220] p-0" aria-describedby={undefined}>
        <DialogHeader className="px-5 pb-2 pt-5">
          <DialogTitle className="text-base">Añadir a una playlist</DialogTitle>
        </DialogHeader>
        <div className="px-5 pb-5">
          {track && (
            <p className="mb-4 truncate text-xs text-muted-foreground">
              {track.title} · {track.artist}
            </p>
          )}

          <div className="mb-4 flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre de la nueva playlist"
              className="bg-secondary/60 border-border"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              maxLength={60}
            />
            <Button onClick={handleCreate} className="vortex-gradient shrink-0 px-3 font-bold text-white hover:opacity-90">
              <Plus className="h-4 w-4" /> Crear
            </Button>
          </div>

          <div className="scrollbar-thin max-h-64 overflow-y-auto rounded-lg">
            {playlists.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aún no tienes playlists. Crea la primera arriba.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => handleAdd(pl.id, pl.name)}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-secondary/70"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundImage: PLAYLIST_GRADIENTS[pl.gradient % PLAYLIST_GRADIENTS.length] }}
                    >
                      <ListPlus className="h-4 w-4 text-white" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{pl.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {pl.tracks.length} {pl.tracks.length === 1 ? "canción" : "canciones"}
                      </span>
                    </span>
                    <Check className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PlaylistCover({ gradient, className }: { gradient: number; className?: string }) {
  return (
    <span
      className={cn("flex items-center justify-center rounded-lg vortex-gradient", className)}
      style={{ backgroundImage: PLAYLIST_GRADIENTS[gradient % PLAYLIST_GRADIENTS.length] }}
      aria-hidden="true"
    >
      <ListPlus className="h-1/3 w-1/3 text-white/90" />
    </span>
  );
}
