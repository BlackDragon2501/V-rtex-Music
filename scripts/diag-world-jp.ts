// Diagnóstico del bloque Japón en la sección "Rincón del mundo" de la portada.
// Llama a las funciones reales de los adaptadores y muestra qué llega.
// Ejecutar: bun scripts/diag-world-jp.ts
import { wikimediaLanguage } from "../src/lib/music/wikimedia";
import { jamendoWorld } from "../src/lib/music/jamendo";

const jpW = await wikimediaLanguage("jp", 18, 0).catch((e) => {
  console.error("wmJp ERROR:", e.message);
  return [];
});
console.log(`wmJp: ${jpW.length} pistas`);
for (const t of jpW.slice(0, 8)) console.log(`  · ${t.title.slice(0, 50)} | ${t.artist.slice(0, 24)}`);

const jpJ = await jamendoWorld("jp", 12, 0).catch((e) => {
  console.error("jmJp ERROR:", e.message);
  return [];
});
console.log(`jmJp: ${jpJ.length} pistas`);
for (const t of jpJ.slice(0, 6)) console.log(`  · ${t.title.slice(0, 50)} | ${t.artist.slice(0, 24)}`);
