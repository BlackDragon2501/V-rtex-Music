"use client";

import { useState } from "react";
import { Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlbumArtProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  iconClassName?: string;
  rounded?: string;
}

// Portada con respaldo: si no hay imagen o falla, muestra un degradado Vórtex.
export function AlbumArt({ src, alt, className, iconClassName, rounded = "rounded-lg" }: AlbumArtProps) {
  const [error, setError] = useState(false);
  const showFallback = !src || error;

  if (showFallback) {
    return (
      <div
        className={cn(
          "vortex-gradient flex items-center justify-center overflow-hidden",
          rounded,
          className
        )}
        role="img"
        aria-label={alt}
      >
        <Music2 className={cn("text-white/70", iconClassName ?? "h-1/3 w-1/3 max-h-16 max-w-16")} />
      </div>
    );
  }

  return (
    <img
      src={src!}
      alt={alt}
      loading="lazy"
      draggable={false}
      onError={() => setError(true)}
      className={cn("object-cover bg-[#0d1424]", rounded, className)}
    />
  );
}
