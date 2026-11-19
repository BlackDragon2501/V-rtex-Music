"use client";

import { Heart, ListMusic, Plus, Home, Search, LibraryBig } from "lucide-react";
import { LogoWordmark } from "@/components/music/Logo";
import { PlaylistCover } from "@/components/dialogs/AddToPlaylistDialog";
import { useNav, type View } from "@/store/nav";
import { useLibrary } from "@/store/library";
import { useCreatePlaylistDialog } from "@/store/dialogs";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { view: View; label: string; icon: typeof Home }[] = [
  { view: { type: "home" }, label: "Inicio", icon: Home },
  { view: { type: "search" }, label: "Buscar", icon: Search },
  { view: { type: "library" }, label: "Biblioteca", icon: LibraryBig },
];

export function Sidebar() {
  const view = useNav((s) => s.stack[s.index]);
  const push = useNav((s) => s.push);
  const playlists = useLibrary((s) => s.playlists);
  const likedCount = useLibrary((s) => s.likedTracks.length);
  const openCreatePlaylist = useCreatePlaylistDialog((s) => s.openCreate);
  const mounted = useMounted();

  const isActive = (v: View) =>
    (v.type === "home" && view.type === "home") ||
    (v.type === "search" && view.type === "search") ||
    (v.type === "library" && view.type === "library");

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col border-r border-white/5 bg-[#080d18] md:flex">
      <div className="px-5 pb-2 pt-5">
        <button onClick={() => push({ type: "home" })} className="text-left" aria-label="Inicio de Vórtex Music">
          <LogoWordmark size={32} />
        </button>
      </div>

      <nav className="mt-3 flex flex-col gap-1 px-3" aria-label="Navegación principal">
        {NAV_ITEMS.map(({ view: v, label, icon: Icon }) => (
          <button
            key={v.type}
            onClick={() => push(v)}
            aria-current={isActive(v) ? "page" : undefined}
            className={cn(
              "flex items-center gap-4 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
              isActive(v) ? "bg-secondary/80 text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-5 w-5" /> {label}
          </button>
        ))}
      </nav>

      <div className="mx-5 my-3 border-t border-white/10" />

      {/* Crear playlist (estilo Spotify: opción siempre visible en la biblioteca) */}
      <div className="px-3">
        <button
          onClick={openCreatePlaylist}
          className="flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          aria-label="Crear playlist"
        >
          <span className="vortex-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white">
            <Plus className="h-5 w-5" />
          </span>
          Crear playlist
        </button>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tu biblioteca</span>
          <button
            onClick={openCreatePlaylist}
            aria-label="Crear playlist"
            title="Nueva playlist"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={() => push({ type: "liked" })}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors",
            view.type === "liked" ? "bg-secondary/80" : "hover:bg-secondary/60"
          )}
        >
          <span className="vortex-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-md">
            <Heart className="h-5 w-5 fill-white text-white" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">Me gusta</span>
            <span className="block text-xs text-muted-foreground">
              {mounted ? `${likedCount} ${likedCount === 1 ? "canción" : "canciones"}` : "Tu playlist automática"}
            </span>
          </span>
        </button>

        {mounted &&
          playlists.map((pl) => (
          <button
            key={pl.id}
            onClick={() => push({ type: "playlist", id: pl.id })}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors",
              view.type === "playlist" && view.id === pl.id ? "bg-secondary/80" : "hover:bg-secondary/60"
            )}
          >
            <PlaylistCover gradient={pl.gradient} className="h-11 w-11 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{pl.name}</span>
              <span className="block text-xs text-muted-foreground">Playlist · {pl.tracks.length}</span>
            </span>
          </button>
        ))}

        {mounted && playlists.length === 0 && (
          <p className="px-3 py-3 text-xs leading-relaxed text-muted-foreground">
            Crea tu primera playlist con el botón + y guarda tus canciones favoritas.
          </p>
        )}
      </div>

      <div className="border-t border-white/10 px-5 py-3">
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <ListMusic className="h-3.5 w-3.5 text-vortex-soft" />
          100% gratis · Sin anuncios · Música online
        </p>
      </div>
    </aside>
  );
}
