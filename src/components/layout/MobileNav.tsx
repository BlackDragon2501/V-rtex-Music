"use client";

import { Heart, Home, LibraryBig, Search } from "lucide-react";
import { useNav } from "@/store/nav";
import { cn } from "@/lib/utils";

// Navegación inferior para móviles (estilo app de YouTube Music).
export function MobileNav() {
  const view = useNav((s) => s.stack[s.index]);
  const push = useNav((s) => s.push);

  const items = [
    { type: "home" as const, label: "Inicio", icon: Home },
    { type: "search" as const, label: "Buscar", icon: Search },
    { type: "library" as const, label: "Biblioteca", icon: LibraryBig },
  ];

  return (
    <nav
      className="z-40 flex h-[58px] items-stretch justify-around border-t border-white/5 bg-[#080d18]/97 backdrop-blur sm:hidden"
      aria-label="Navegación móvil"
    >
      {items.map(({ type, label, icon: Icon }) => {
        const active = view.type === type;
        return (
          <button
            key={type}
            onClick={() => push({ type })}
            className={cn(
              "flex min-w-[64px] flex-col items-center justify-center gap-1 px-2 text-[10px] font-semibold transition-colors",
              active ? "text-vortex-soft" : "text-muted-foreground"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        );
      })}
      <button
        onClick={() => push({ type: "liked" })}
        className={cn(
          "flex min-w-[64px] flex-col items-center justify-center gap-1 px-2 text-[10px] font-semibold transition-colors",
          view.type === "liked" ? "text-vortex-soft" : "text-muted-foreground"
        )}
      >
        <Heart className="h-5 w-5" />
        Me gusta
      </button>
    </nav>
  );
}
