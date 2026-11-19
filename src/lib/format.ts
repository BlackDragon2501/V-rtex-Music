export function formatDuration(sec: number | undefined): string {
  if (!sec || !isFinite(sec) || sec <= 0) return "–:––";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatLongDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

// Paletas para portadas de playlists creadas por el usuario.
// Usan variables CSS del tema activo (azul Vórtex o el modo alternativo),
// así cambian de color automáticamente al cambiar de tema.
export const PLAYLIST_GRADIENTS: string[] = [
  "linear-gradient(135deg,var(--vortex),var(--vortex-2))",
  "linear-gradient(135deg,#0ea5e9,var(--vortex))",
  "linear-gradient(135deg,var(--vortex-mid),#b44cff)",
  "linear-gradient(135deg,#1e3a8a,var(--vortex))",
  "linear-gradient(135deg,var(--vortex-glow),var(--vortex))",
  "linear-gradient(135deg,var(--vortex-2),#f0445a)",
];

// Gradientes decorativos de las radios por género (también por tema).
export const GENRE_GRADIENTS: string[] = [
  "linear-gradient(135deg,var(--vortex),#0ea5e9)",
  "linear-gradient(135deg,var(--vortex-2),var(--vortex))",
  "linear-gradient(135deg,var(--vortex-mid),#b44cff)",
  "linear-gradient(135deg,#1e3a8a,var(--vortex))",
  "linear-gradient(135deg,var(--vortex-glow),var(--vortex-2))",
  "linear-gradient(135deg,var(--vortex),var(--vortex-2))",
];

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}
