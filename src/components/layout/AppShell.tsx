"use client";

import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import { PlayerBar } from "@/components/player/PlayerBar";
import { QueuePanel } from "@/components/player/QueuePanel";
import { NowPlaying } from "@/components/player/NowPlaying";
import { AddToPlaylistDialog } from "@/components/dialogs/AddToPlaylistDialog";
import { CreatePlaylistDialog } from "@/components/dialogs/CreatePlaylistDialog";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Footer } from "@/components/layout/Footer";
import { HomeView } from "@/components/views/HomeView";
import { SearchView } from "@/components/views/SearchView";
import { ArtistView } from "@/components/views/ArtistView";
import { AlbumView } from "@/components/views/AlbumView";
import { GenreView } from "@/components/views/GenreView";
import { PlaylistView } from "@/components/views/PlaylistView";
import { LikedView } from "@/components/views/LikedView";
import { LibraryView } from "@/components/views/LibraryView";
import { useNav, viewKey } from "@/store/nav";
import { usePlayer } from "@/store/player";
import { useMounted } from "@/hooks/use-mounted";

function CurrentView() {
  const view = useNav((s) => s.stack[s.index]);
  switch (view.type) {
    case "search":
      return <SearchView q={view.q} />;
    case "artist":
      return <ArtistView id={view.id} />;
    case "album":
      return <AlbumView id={view.id} />;
    case "genre":
      return <GenreView slug={view.slug} />;
    case "playlist":
      return <PlaylistView id={view.id} />;
    case "liked":
      return <LikedView />;
    case "library":
      return <LibraryView />;
    default:
      return <HomeView />;
  }
}

export function AppShell() {
  const view = useNav((s) => s.stack[s.index]);
  const scrollRef = useRef<HTMLElement>(null);
  const mounted = useMounted();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 60_000,
          },
        },
      })
  );

  // Reset del scroll al cambiar de vista.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [viewKey(view)]);

  // Atajos de teclado: espacio = play/pausa, flechas = anterior/siguiente.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing) return;
      if (e.code === "Space") {
        e.preventDefault();
        usePlayer.getState().togglePlay();
      } else if (e.code === "ArrowRight" && e.shiftKey) {
        usePlayer.getState().next();
      } else if (e.code === "ArrowLeft" && e.shiftKey) {
        usePlayer.getState().prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PlayerProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <div className="relative flex min-h-0 flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main
              id="vortex-main"
              ref={scrollRef}
              className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pb-6"
            >
              {/* Columna mínima de alto completo: el footer queda pegado abajo
                  cuando la vista es corta y empujado al final del scroll cuando
                  es larga (nunca tapa al reproductor: vive dentro del main). */}
              <div className="flex min-h-full flex-col">
                <CurrentView />
                <Footer />
              </div>
            </main>
          </div>
          <QueuePanel mounted={mounted} />
        </div>
        {mounted ? <PlayerBar /> : null}
        <MobileNav />
        {mounted ? <NowPlaying /> : null}
        {mounted ? <AddToPlaylistDialog /> : null}
        {mounted ? <CreatePlaylistDialog /> : null}
        <Toaster position="top-center" richColors closeButton />
      </div>
    </PlayerProvider>
    </QueryClientProvider>
  );
}
