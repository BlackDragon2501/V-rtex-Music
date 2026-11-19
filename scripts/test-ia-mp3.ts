// Test end-to-end del guardián MP3 de Internet Archive sin red:
// simula las respuestas de archive.org/metadata con FLAC/WAV/MP3/imagen/texto
// mezclados (como el álbum "Herida Eterna" del usuario) y verifica que
// iaBrowserAlbumDetail solo extrae .mp3 y lanza NoMp3Error cuando no hay ninguno.
import {
  iaBrowserAlbumDetail,
  iaBrowserSearch,
} from "../src/lib/music/ia-browser.ts";
import { NoMp3Error, NO_MP3_MESSAGE, streamUrlSegura, isMp3Url } from "../src/lib/music/mp3.ts";

let failures = 0;
function check(name: string, cond: boolean, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"} · ${name}${extra ? " → " + extra : ""}`);
  if (!cond) failures++;
}

// ---------- metadato simulado: disco con 3 canciones ----------
// originals en FLAC/WAV + derivados MP3 de IA + basura (imagen, texto, ogg)
const identifier = "test-album-herida";
function mdWithMp3() {
  return {
    metadata: {
      title: "Herida Eterna",
      creator: "Jaguar del Alba",
      album: "Herida Eterna",
      date: "2025",
    },
    files: [
      { name: "herida_eterna_meta.xml", format: "Metadata", size: "5000" },
      { name: "herida_eterna.jpg", format: "JPEG", size: "80000" },
      { name: "01 - Sombras que besan la luz.flac", format: "Flac", size: "35000000", length: "245" },
      { name: "02 - La corona del silencio.wav", format: "WAV", size: "48000000", length: "198" },
      { name: "03 - Fuego lento.ogg", format: "Ogg Vorbis", size: "29000000", length: "210" },
      { name: "01 - Sombras que besan la luz.mp3", format: "VBR MP3", size: "5800000", length: "245", track: "1" },
      { name: "02 - La corona del silencio.mp3", format: "128Kbps MP3", size: "3100000", length: "198", track: "2" },
      { name: "03 - Fuego lento.mp3", format: "320Kbps MP3", size: "8000000", length: "210", track: "3" },
      { name: "01 - Sombras que besan la luz_64kb.mp3", format: "64Kbps MP3", size: "1500000", length: "245", track: "1" },
    ],
  };
}
// disco SIN ni un MP3 (solo originales sin derivar + imagen + texto)
function mdSinMp3() {
  return {
    metadata: { title: "Solo Flac", creator: "Jaguar del Alba", date: "2025" },
    files: [
      { name: "a.txt", format: "Text", size: "300" },
      { name: "portada.png", format: "PNG", size: "90000" },
      { name: "01 - Cancion.flac", format: "Flac", size: "35000000", length: "200" },
      { name: "02 - Otra.wav", format: "WAV", size: "48000000", length: "180" },
    ],
  };
}

// Stub de fetch global: responde /metadata/<id> según el id pedido.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: unknown) => {
  const url = String(input);
  if (url.includes("/metadata/test-album-herida")) {
    return new Response(JSON.stringify(mdWithMp3()), { status: 200 });
  }
  if (url.includes("/metadata/test-album-sin-mp3")) {
    return new Response(JSON.stringify(mdSinMp3()), { status: 200 });
  }
  // advancedsearch / resto: vacío (no interviene en esta prueba)
  return new Response(JSON.stringify({ response: { docs: [] } }), { status: 200 });
}) as typeof fetch;

// ---------- 1. Álbum con MP3 mezclados con FLAC/WAV ----------
const detail = await iaBrowserAlbumDetail(`ia-album-${identifier}`);
check("álbum: 3 pistas MP3 extraídas (no 4: el derivado 64kb repite título)", detail.tracks.length === 3, `${detail.tracks.length} pistas`);
check("todas las streamUrl terminan en .mp3", detail.tracks.every((t) => isMp3Url(t.streamUrl)), detail.tracks.map((t) => t.streamUrl.split("/").pop()).join(", "));
check("ninguna pista apunta a .flac/.wav/.ogg", detail.tracks.every((t) => !/\.(flac|wav|ogg)$/i.test(t.streamUrl)));
check("orden de disco 1→2→3", detail.tracks.map((t) => t.title).join("|") === "Sombras que besan la luz|La corona del silencio|Fuego lento");
check("artista desde creator", detail.album.artist === "Jaguar del Alba");
check("título del álbum desde campo album", detail.album.title === "Herida Eterna");
check("streamUrlSegura(archive) acepta las URLs", detail.tracks.every((t) => streamUrlSegura(t.streamUrl, "archive")));

// ---------- 2. Álbum SIN ningún MP3 → NoMp3Error ----------
let threw = "";
try {
  await iaBrowserAlbumDetail("ia-album-test-album-sin-mp3");
} catch (e) {
  threw = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}
check("álbum sin MP3 lanza NoMp3Error", threw === `NoMp3Error: ${NO_MP3_MESSAGE}`, threw);
check("el mensaje exacto es el pedido por el usuario", NO_MP3_MESSAGE === "Este álbum no contiene archivos MP3 compatibles");

// ---------- 3. Búsqueda: el objeto sin MP3 no aporta pistas ----------
const hits = await iaBrowserSearch("Solo Flac");
check("búsqueda: disco sin MP3 aporta 0 canciones", hits.length === 0, `${hits.length}`);

// ---------- 4. Guardián de URLs del reproductor ----------
check("streamUrlSegura: URL de Audius (http) pasa", streamUrlSegura("https://audius.example/stream?x=1", "audius"));
check("streamUrlSegura: MP3 directo de IA pasa", streamUrlSegura("https://archive.org/download/x/y.mp3", "archive"));
check("streamUrlSegura: FLAC de IA NO pasa", !streamUrlSegura("https://archive.org/download/x/y.flac", "archive"));
check("streamUrlSegura: WAV de IA NO pasa", !streamUrlSegura("https://archive.org/download/x/y.wav?orig=1", "archive"));
check("streamUrlSegura: URL vacía/junk no pasa", !streamUrlSegura("", "archive") && !streamUrlSegura("javascript:alert(1)", "audius"));

globalThis.fetch = realFetch;
console.log(failures === 0 ? "\nTODO OK ✔" : `\n${failures} FALLOS`);
process.exit(failures === 0 ? 0 : 1);
