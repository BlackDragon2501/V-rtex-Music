"use client";

import { Clock, X } from "lucide-react";
import { useSearchHistory } from "@/store/search-history";

// Panel desplegable del historial de búsqueda (Búsquedas recientes).
// · Aparece al hacer clic/enfocar el campo de búsqueda.
// · Cada fila tiene un icono X para eliminar esa búsqueda individualmente.
// · Botón "Limpiar todo" en la parte superior del dropdown.
// · Los datos viven en localStorage (store search-history).
export function RecentSearchesPanel({
  onSelect,
  className,
}: {
  onSelect: (q: string) => void;
  className?: string;
}) {
  const items = useSearchHistory((s) => s.items);
  const remove = useSearchHistory((s) => s.remove);
  const clearAll = useSearchHistory((s) => s.clearAll);

  if (items.length === 0) return null;

  return (
    <div
      className={
        className ??
        "absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
      }
      role="listbox"
      aria-label="Búsquedas recientes"
    >
      {/* Cabecera: título + Limpiar todo */}
      <div className="flex items-center justify-between border-b border-border/70 px-3.5 py-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Búsquedas recientes
        </span>
        <button
          onClick={clearAll}
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Limpiar todo el historial de búsqueda"
        >
          Limpiar todo
        </button>
      </div>

      <ul className="max-h-72 overflow-y-auto py-1">
        {items.map((q) => (
          <li key={q} className="group flex items-center">
            <button
              onClick={() => onSelect(q)}
              className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-2 text-left text-sm transition-colors hover:bg-secondary/70"
              aria-label={`Buscar ${q}`}
            >
              <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{q}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                remove(q);
              }}
              onMouseDown={(e) => e.preventDefault()}
              className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-secondary hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-0"
              aria-label={`Eliminar ${q} del historial`}
              title="Eliminar del historial"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
