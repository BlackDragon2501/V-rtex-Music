// Verificación de la rotación: Tendencias y Radios con la MISMA sesión.
// Ejecutar: bun scripts/test-rotation.ts
const BASE = "http://localhost:3000";

interface T { id: string; title: string; artist: string; duration: number; source: string }

async function get(url: string): Promise<any> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

function ids(a: T[]): string[] { return a.map((t) => t.id); }
function overlap(a: string[], b: string[]): number {
  const s = new Set(b);
  return a.filter((x) => s.has(x)).length;
}
function preview(a: T[], n = 4): string {
  return a.slice(0, n).map((t) => `${t.title} — ${t.artist}`).join(" | ");
}

async function main() {
  console.log("========== HOME (Tendencias) ==========");
  const h1 = await get(`${BASE}/api/music/home?sid=qa1`);
  console.log(`Visita 1 → trending:${h1.trending.length} under:${h1.underground.length} fresh:${h1.fresh.length} cc:${h1.ccTracks.length} world:${h1.world.length}`);
  console.log(`  trending[0..3]: ${preview(h1.trending)}`);

  const h2 = await get(`${BASE}/api/music/home?sid=qa1`);
  console.log(`Visita 2 (misma sesión) → trending:${h2.trending.length} under:${h2.underground.length} fresh:${h2.fresh.length} cc:${h2.ccTracks.length} world:${h2.world.length}`);
  console.log(`  trending[0..3]: ${preview(h2.trending)}`);

  const ovT = overlap(ids(h1.trending), ids(h2.trending));
  const ovU = overlap(ids(h1.underground), ids(h2.underground));
  const ovF = overlap(ids(h1.fresh), ids(h2.fresh));
  const ovC = overlap(ids(h1.ccTracks), ids(h2.ccTracks));
  const ovW = overlap(ids(h1.world), ids(h2.world));
  console.log(`Repetidas entre visita 1 y 2 → trending:${ovT}/24 under:${ovU}/16 fresh:${ovF}/20 cc:${ovC}/24 world:${ovW}/16`);

  const h3 = await get(`${BASE}/api/music/home?sid=qa2`);
  console.log(`Sesión distinta (qa2) vs qa1 visita1 → repetidas trending: ${overlap(ids(h1.trending), ids(h3.trending))}/24`);

  console.log("\n========== RADIO METAL ==========");
  const r1 = await get(`${BASE}/api/music/genre?slug=metal&sid=qa1`);
  console.log(`Visita 1 → ${r1.tracks.length} canciones · ${preview(r1.tracks)}`);
  const r2 = await get(`${BASE}/api/music/genre?slug=metal&sid=qa1`);
  console.log(`Visita 2 (misma sesión) → ${r2.tracks.length} canciones · ${preview(r2.tracks)}`);
  console.log(`Repetidas entre visita 1 y 2: ${overlap(ids(r1.tracks), ids(r2.tracks))}/${r1.tracks.length}`);
  const r3 = await get(`${BASE}/api/music/genre?slug=metal&sid=qa2`);
  console.log(`Sesión distinta (qa2) vs qa1 visita1 → repetidas: ${overlap(ids(r1.tracks), ids(r3.tracks))}/${r1.tracks.length}`);

  console.log("\n========== RADIO RUSA (contenido verificado intacto) ==========");
  const ru = await get(`${BASE}/api/music/genre?slug=ruso&sid=qa1`);
  console.log(`→ ${ru.tracks.length} canciones · ${preview(ru.tracks, 3)}`);
  const ru2 = await get(`${BASE}/api/music/genre?slug=ruso&sid=qa1`);
  console.log(`Visita 2 → repetidas: ${overlap(ids(ru.tracks), ids(ru2.tracks))}/${ru.tracks.length}`);

  console.log("\n========== OTRAS RADIOS (muestreo rápido) ==========");
  for (const slug of ["reggaeton", "rock", "electronica", "china", "jazz", "hip-hop"]) {
    try {
      const d = await get(`${BASE}/api/music/genre?slug=${slug}&sid=qa1`);
      console.log(`${slug}: ${d.tracks.length} canciones · fuentes: ${[...new Set(d.tracks.map((t: T) => t.source))].join(",")}`);
    } catch (e) {
      console.log(`${slug}: ERROR ${(e as Error).message}`);
    }
  }

  console.log("\n========== BÚSQUEDA (sin cambios, debe seguir funcionando) ==========");
  const s = await get(`${BASE}/api/music/search?q=fuego`);
  console.log(`"fuego" → songs:${s.songs?.length} artists:${s.artists?.length}`);
}

main().catch((e) => {
  console.error("FALLO:", e);
  process.exit(1);
});
