"use client";

import { cn } from "@/lib/utils";

// Cada instancia usa un id de gradiente ESTÁTICO y único (sin useId) para
// evitar desajustes de hidratación entre servidor y cliente.
// Los colores salen de las variables del tema activo (azul / esmeralda).
export function VortexLogo({
  size = 30,
  className,
  gid = "vortex-grad",
}: {
  size?: number;
  className?: string;
  gid?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--vortex)" }} />
          <stop offset="100%" style={{ stopColor: "var(--vortex-2)" }} />
        </linearGradient>
      </defs>
      <path
        d="M24 6.5a17.5 17.5 0 1 1-12.6 5.4"
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M24 15.5a8.5 8.5 0 1 1-6.2 2.6"
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="24" cy="24" r="3.2" fill={`url(#${gid})`} />
    </svg>
  );
}

export function LogoWordmark({ size = 30 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <VortexLogo size={size} gid="vgrad-wordmark" />
      <div className="leading-none">
        <span className="text-[17px] font-extrabold tracking-tight vortex-text-gradient">
          Vórtex
        </span>
        <span className="text-[17px] font-extrabold tracking-tight text-foreground"> Music</span>
        <p className="mt-1 text-[10px] font-medium text-muted-foreground">
          Gratis · Sin anuncios
        </p>
      </div>
    </div>
  );
}
