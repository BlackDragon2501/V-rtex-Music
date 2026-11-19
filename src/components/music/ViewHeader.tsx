"use client";

import { ReactNode } from "react";
import { AlbumArt } from "./AlbumArt";
import { BackButton } from "./BackButton";
import { PlaylistCover } from "@/components/dialogs/AddToPlaylistDialog";
import { Heart, AlertCircle, RotateCcw, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNav } from "@/store/nav";

interface ViewHeaderProps {
  kindLabel: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  artwork?: string | null;
  circle?: boolean;
  variant?: "art" | "gradient" | "liked";
  gradientIndex?: number;
}

// Cabecera grande estilo Spotify para álbumes, playlists y artistas.
export function ViewHeader({
  kindLabel,
  title,
  meta,
  actions,
  artwork,
  circle = false,
  variant = "art",
  gradientIndex = 0,
}: ViewHeaderProps) {
  const canGoBack = useNav((s) => s.index > 0);

  return (
    <div className="vortex-gradient relative overflow-hidden rounded-none">
      {/* Botón atrás (←): vuelve a la pantalla desde la que se llegó */}
      {canGoBack && (
        <BackButton className="absolute left-3 top-3 z-10 sm:left-5 sm:top-4" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#05070d] via-[#05070d]/40 to-transparent" />
      <div className="relative flex flex-col items-start gap-5 bg-gradient-to-t from-[#05070d]/60 to-transparent p-6 pt-16 sm:flex-row sm:items-end sm:p-8 sm:pt-24">
        {variant === "art" && (
          <AlbumArt
            src={artwork}
            alt={title}
            rounded={circle ? "rounded-full" : "rounded-xl"}
            className="h-36 w-36 shadow-2xl shadow-black/60 sm:h-44 sm:w-44"
            iconClassName="h-1/3 w-1/3"
          />
        )}
        {variant === "gradient" && <PlaylistCover gradient={gradientIndex} className="h-36 w-36 shadow-2xl shadow-black/60 sm:h-44 sm:w-44" />}
        {variant === "liked" && (
          <span className="vortex-gradient flex h-36 w-36 items-center justify-center rounded-xl shadow-2xl shadow-black/60 sm:h-44 sm:w-44">
            <Heart className="h-14 w-14 fill-white text-white" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-white/80">{kindLabel}</p>
          <h1 className="mt-2 break-words text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          {meta && <div className="mt-3 text-sm text-white/80">{meta}</div>}
          {actions && <div className="mt-5 flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <AlertCircle className="h-10 w-10 text-destructive/80" />
      <div>
        <p className="font-semibold">Algo salió mal</p>
        <p className="mt-1 text-sm text-muted-foreground">{message ?? "No pudimos cargar este contenido."}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RotateCcw className="h-4 w-4" /> Reintentar
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, message, icon }: { title: string; message: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        {icon ?? <Music2 className="h-7 w-7" />}
      </span>
      <p className="text-lg font-bold">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function CardsSkeleton({ count = 6, circle = false }: { count?: number; circle?: boolean }) {
  return (
    <div className="flex gap-1 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[46%] shrink-0 sm:w-[220px] md:w-[200px] lg:w-[190px]">
          <div className="rounded-xl p-3">
            <div className={cn("mb-3 aspect-square w-full animate-pulse bg-secondary", circle ? "rounded-full" : "rounded-lg")} />
            <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-secondary" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RowsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-3 py-2">
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-md bg-secondary" />
          <div className="flex-1">
            <div className="mb-2 h-4 w-1/3 animate-pulse rounded bg-secondary" />
            <div className="h-3 w-1/5 animate-pulse rounded bg-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}
