"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCreatePlaylistDialog } from "@/store/dialogs";
import { useLibrary } from "@/store/library";
import { useNav } from "@/store/nav";

// Diálogo para crear una playlist nueva (estilo Spotify): nombre + descripción opcional.
export function CreatePlaylistDialog() {
  const open = useCreatePlaylistDialog((s) => s.open);
  const close = useCreatePlaylistDialog((s) => s.close);
  const playlists = useLibrary((s) => s.playlists);
  const createPlaylist = useLibrary((s) => s.createPlaylist);
  const push = useNav((s) => s.push);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    const finalName = name.trim() || `Mi playlist #${playlists.length + 1}`;
    const pl = createPlaylist(finalName, [], description);
    setName("");
    setDescription("");
    toast.success(`Playlist "${pl.name}" creada`);
    close();
    push({ type: "playlist", id: pl.id });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : close())}>
      <DialogContent className="max-w-md border-border bg-[#0b1220] p-0">
        <DialogHeader className="px-5 pb-1 pt-5">
          <DialogTitle>Nueva playlist</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Ponle un nombre y, si quieres, una descripción. Podrás añadir canciones después.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-5 pb-5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la playlist"
            autoFocus
            maxLength={60}
            className="border-border bg-secondary/60"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            aria-label="Nombre de la playlist"
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción (opcional)"
            rows={3}
            maxLength={200}
            className="resize-none border-border bg-secondary/60"
            aria-label="Descripción de la playlist"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} className="vortex-gradient px-4 font-bold text-white hover:opacity-90">
              Crear
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
