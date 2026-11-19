"use client";

import { ArrowLeft } from "lucide-react";
import { useNav } from "@/store/nav";
import { cn } from "@/lib/utils";

// Botón de retroceso (←) compartido por TODAS las vistas internas
// (radios/géneros, artistas, álbumes, playlists y búsqueda).
//
// Navega por la pila interna de la app, el equivalente al router.back() de
// Next.js pero SIN recargar la página: el elemento <audio> vive fuera del
// árbol de vistas, así que la música sigue sonando sin interrupción mientras
// la interfaz vuelve a la pantalla anterior (o a la Home si no hay previa).
export function BackButton({
  className,
  tone = "onGradient",
}: {
  className?: string;
  tone?: "onGradient" | "plain";
}) {
  const index = useNav((s) => s.index);
  const back = useNav((s) => s.back);
  const goHome = useNav((s) => s.goHome);

  return (
    <button
      onClick={() => (index > 0 ? back() : goHome())}
      aria-label="Volver atrás"
      title="Atrás"
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
        tone === "onGradient"
          ? "bg-black/45 text-white backdrop-blur hover:bg-black/65"
          : "bg-secondary text-foreground hover:bg-secondary/80",
        className
      )}
    >
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
