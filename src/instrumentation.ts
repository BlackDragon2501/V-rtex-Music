// Hook de instrumentación de Next.js: se ejecuta UNA vez al arrancar el
// servidor (nodejs runtime). Es el punto de entrada del cron de rotación
// diaria del catálogo (ver src/lib/music/scheduler.ts).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startDailyRotation } = await import("@/lib/music/scheduler");
  startDailyRotation();
}
