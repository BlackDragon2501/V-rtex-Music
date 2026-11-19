// Estilo compartido de los botones de acción de las cabeceras de vista.
export function cnBtn(active: boolean): string {
  return [
    "flex h-12 items-center gap-2 rounded-full border px-5 text-sm font-bold transition-colors",
    active ? "border-vortex bg-vortex/15 text-vortex-soft" : "border-white/30 text-white hover:bg-white/10",
  ].join(" ");
}
