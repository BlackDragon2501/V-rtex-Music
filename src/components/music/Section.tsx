"use client";

import { ReactNode, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionProps {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
  carousel?: boolean;
  children: ReactNode;
}

// Sección de portada con carrusel horizontal (flechas en escritorio) o cuadrícula.
export function Section({ title, subtitle, onSeeAll, carousel = true, children }: SectionProps) {
  const scroller = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    scroller.current?.scrollBy({ left: dir * 640, behavior: "smooth" });
  };

  return (
    <section className="mt-8 first:mt-0" aria-label={title}>
      <div className="mb-3 flex items-end justify-between gap-4 px-1">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {onSeeAll && (
            <button
              onClick={onSeeAll}
              className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
            >
              Ver todo
            </button>
          )}
          {carousel && (
            <div className="hidden gap-1 md:flex">
              <button
                onClick={() => scrollBy(-1)}
                aria-label="Desplazar a la izquierda"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/70 text-foreground transition-colors hover:bg-secondary"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => scrollBy(1)}
                aria-label="Desplazar a la derecha"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/70 text-foreground transition-colors hover:bg-secondary"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
      {carousel ? (
        <div
          ref={scroller}
          className={cn("no-scrollbar flex snap-x gap-1 overflow-x-auto pb-1", "scroll-smooth")}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

export function CarouselItem({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("w-[46%] shrink-0 snap-start sm:w-[220px] md:w-[200px] lg:w-[190px]", className)}>
      {children}
    </div>
  );
}
