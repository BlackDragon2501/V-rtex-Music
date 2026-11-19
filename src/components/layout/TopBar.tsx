"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Palette, Search } from "lucide-react";
import { useNav } from "@/store/nav";
import { useTheme, applyTheme, type VortexTheme } from "@/store/theme";
import { useSearchHistory } from "@/store/search-history";
import { RecentSearchesPanel } from "@/components/music/RecentSearches";
import { VortexLogo } from "@/components/music/Logo";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEMES: { value: VortexTheme; label: string; hint: string }[] = [
  { value: "azul", label: "Azul Vórtex", hint: "Azul eléctrico + violeta" },
  { value: "esmeralda", label: "Esmeralda", hint: "Modo alternativo" },
];

// Barra superior: navegación atrás/adelante + buscador global + modo de colores (estilo Spotify).
export function TopBar() {
  const view = useNav((s) => s.stack[s.index]);
  const index = useNav((s) => s.index);
  const stackLen = useNav((s) => s.stack.length);
  const back = useNav((s) => s.back);
  const forward = useNav((s) => s.forward);
  const push = useNav((s) => s.push);
  const replace = useNav((s) => s.replace);
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);

  const [q, setQ] = useState(view.type === "search" ? view.q ?? "" : "");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushed = useRef("");

  // Historial de búsqueda: se guarda al pulsar Enter y se muestra al hacer clic
  // en el campo. Datos en localStorage (store search-history).
  const addSearch = useSearchHistory((s) => s.add);
  const [histOpen, setHistOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Cerrar el dropdown al hacer clic fuera del buscador.
  useEffect(() => {
    if (!histOpen) return;
    const onDown = (e: PointerEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setHistOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [histOpen]);

  // Sincronizar el input con la vista al navegar (atrás/adelante/sugerencias).
  // Patrón de ajuste de estado durante el render (React docs) en vez de useEffect.
  const viewQ = view.type === "search" ? view.q ?? "" : undefined;
  const [lastViewQ, setLastViewQ] = useState<string | undefined>(viewQ);
  if (viewQ !== lastViewQ) {
    setLastViewQ(viewQ);
    if (view.type === "search") setQ(view.q ?? "");
  }

  const onSearchChange = (value: string) => {
    setQ(value);
    // Mientras se escribe, el dropdown del historial deja paso a los resultados.
    if (histOpen) setHistOpen(false);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        if (lastPushed.current) {
          push({ type: "search" });
          lastPushed.current = "";
        }
        return;
      }
      const target = `search:${trimmed}`;
      if (lastPushed.current === target) return;
      if (useNav.getState().stack[useNav.getState().index].type === "search") {
        replace({ type: "search", q: trimmed });
      } else {
        push({ type: "search", q: trimmed });
      }
      lastPushed.current = target;
    }, 350);
  };

  const scrolled = useRef(false);
  const [atTop, setAtTop] = useState(true);
  useEffect(() => {
    const main = document.getElementById("vortex-main");
    if (!main) return;
    const onScroll = () => {
      const top = main.scrollTop < 10;
      if (top !== scrolled.current) {
        scrolled.current = top;
        setAtTop(top);
      }
    };
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-16 items-center gap-2 px-3 transition-colors sm:gap-3 sm:px-4",
        atTop ? "bg-transparent" : "bg-[#0a0f1c]/90 backdrop-blur supports-[backdrop-filter]:bg-[#0a0f1c]/75"
      )}
    >
      {/* Botones atrás/adelante (escritorio) */}
      <div className="hidden items-center gap-1 md:flex">
        <button
          onClick={back}
          disabled={index <= 0}
          aria-label="Atrás"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-foreground transition-opacity hover:opacity-100 disabled:opacity-40"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={forward}
          disabled={index >= stackLen - 1}
          aria-label="Adelante"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-foreground transition-opacity hover:opacity-100 disabled:opacity-40"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Marca compacta en móvil */}
      <button
        onClick={() => push({ type: "home" })}
        className="flex items-center gap-2 md:hidden"
        aria-label="Vórtex Music"
      >
        <VortexLogo size={26} gid="vgrad-topbar" />
        <span className="text-base font-extrabold vortex-text-gradient">Vórtex</span>
      </button>

      {/* Buscador */}
      <div className="relative ml-auto w-full max-w-md md:ml-2" ref={searchBoxRef}>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setHistOpen(true)}
          onClick={() => setHistOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const trimmed = q.trim();
              if (trimmed.length >= 2) addSearch(trimmed);
              setHistOpen(false);
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              setHistOpen(false);
            }
          }}
          onBlur={(e) => {
            // Al salir del campo con el texto ya escrito, registrar la búsqueda.
            const trimmed = e.target.value.trim();
            if (trimmed.length >= 2) addSearch(trimmed);
          }}
          placeholder="¿Qué quieres escuchar? Canciones, artistas, álbumes…"
          aria-label="Buscar música"
          className={cn(
            "h-10 w-full rounded-full border border-border bg-secondary/70 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground",
            "focus:border-vortex/60 focus:bg-secondary focus:outline-none focus:ring-2 focus:ring-vortex/30"
          )}
        />
        {histOpen && <RecentSearchesPanel onSelect={(sel) => {
          addSearch(sel);
          setQ(sel);
          setHistOpen(false);
          if (useNav.getState().stack[useNav.getState().index].type === "search") {
            replace({ type: "search", q: sel });
          } else {
            push({ type: "search", q: sel });
          }
          lastPushed.current = `search:${sel}`;
          if (debounce.current) clearTimeout(debounce.current);
          searchBoxRef.current?.querySelector("input")?.blur();
        }} />}
      </div>

      {/* Selector de modo de colores */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Cambiar modo de colores"
            title="Modo de colores"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Palette className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 border-border bg-popover/95 backdrop-blur">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Modo de colores</DropdownMenuLabel>
          {THEMES.map((t) => (
            <DropdownMenuItem
              key={t.value}
              onClick={() => {
                setTheme(t.value);
                applyTheme(t.value);
              }}
            >
              <span
                aria-hidden="true"
                className="h-4 w-4 shrink-0 rounded-full"
                style={{
                  backgroundImage:
                    t.value === "azul"
                      ? "linear-gradient(135deg,#2e7cff,#7c5cff)"
                      : "linear-gradient(135deg,#10b981,#2dd4bf)",
                }}
              />
              <span className="flex-1">
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className="block text-[11px] text-muted-foreground">{t.hint}</span>
              </span>
              {theme === t.value && <Check className="h-4 w-4 text-vortex-soft" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Insignia */}
      <span className="hidden shrink-0 rounded-full border border-vortex/40 bg-vortex/10 px-3 py-1.5 text-[11px] font-bold text-vortex-soft lg:block">
        Gratis · Sin anuncios
      </span>
    </header>
  );
}
