// Prueba OFFLINE del módulo de Internet Archive: sustituye el fetch global por
// respuestas de ejemplo con el formato REAL de la API de IA (advancedsearch +
// metadata) y verifica el mapeo a Track, los filtros y la resolución.
import assert from "node:assert";

const fixtureSearch = {
  response: {
    numFound: 3,
    docs: [
      { identifier: "nl-album-1", title: "Noise Waves", creator: "The Static Fields", year: "2019" },
      { identifier: "nl-album-2", title: "Hard Times EP", creator: ["Rust & Bone"], year: "2021" },
      { identifier: "legacy-78", title: "Blue Yodel No. 1 (78rpm)", creator: "Jimmie Rodgers" },
    ],
  },
};

const fixtureMeta: Record<string, unknown> = {
  "nl-album-1": {
    metadata: { title: "Noise Waves", creator: "The Static Fields" },
    files: [
      { name: "Noise Waves/01 - Loud City.mp3", format: "VBR MP3", title: "Loud City", track: "1", length: "184.35", size: "4300000" },
      { name: "Noise Waves/02 - Static Sea.mp3", format: "VBR MP3", title: "Static Sea", track: "2", length: "3:47", size: "5100000" },
      // Tercera pista: fuera por MAX_PER_ITEM (máximo 2 pistas por objeto)
      { name: "Noise Waves/03 - Whisper.mp3", format: "VBR MP3", title: "Whisper", track: "3", length: "210", size: "4900000" },
      { name: "Noise Waves/cover.flac", format: "Flac", length: "180", size: "30000000" }, // no MP3 → fuera
      { name: "Noise Waves/04 - Whisper.ogg", format: "Ogg Vorbis", length: "200", size: "3000000" }, // no MP3 → fuera
    ],
  },
  "nl-album-2": {
    // Objeto con acceso restringido (requiere cuenta): debe saltarse entero
    metadata: { title: "Hard Times EP", creator: ["Rust & Bone"], "access-restricted-item": "true" },
    files: [{ name: "01 hard times.mp3", format: "MP3", length: "150", size: "3000000" }],
  },
  "legacy-78": {
    metadata: { title: "Blue Yodel No. 1 (78rpm)", creator: "Jimmie Rodgers" },
    files: [
      // Único MP3 disponible y de baja tasa: se acepta (mejor eso que nada)
      { name: "blue-yodel.mp3", format: "64Kbps MP3", length: "170", size: "1400000" },
      { name: "too-short.mp3", format: "VBR MP3", length: "12", size: "200000" }, // <60 s → fuera
      { name: "way-too-long.mp3", format: "VBR MP3", length: "4:00:00", size: "90000000" }, // >1800 s → fuera
    ],
  },
};

function jsonRes(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

(globalThis as { fetch: unknown }).fetch = async (url: unknown) => {
  const u = String(url);
  if (u.includes("advancedsearch.php")) return jsonRes(fixtureSearch);
  const m = /archive\.org\/metadata\/([^/?]+)/.exec(u);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (id in fixtureMeta) return jsonRes(fixtureMeta[id]);
    return jsonRes({ files: [], metadata: {} });
  }
  throw new Error("URL inesperada: " + u);
};

const { archiveByQuery, archiveSearch, archiveResolve, archiveReachable } = await import(
  "../src/lib/music/archive"
);

// 1) Radio por consulta: búsqueda + metadatos + filtros y orden
const tracks = await archiveByQuery("metal", 24, 1);
console.log("pistas:", tracks.map((t) => `${t.title} · ${t.artist} · ${t.duration}s`));
assert.strictEqual(tracks.length, 3, "esperadas 3 (2 de album-1, 0 del restringido, 1 de legacy-78)");

const loud = tracks[0];
assert.strictEqual(loud.title, "Loud City");
assert.strictEqual(loud.artist, "The Static Fields");
assert.strictEqual(loud.source, "archive");
assert.strictEqual(loud.preview, false);
assert.strictEqual(loud.duration, 184, "184.35 → 184 s");
assert.strictEqual(loud.album, "Noise Waves");
assert.strictEqual(loud.artwork, "https://archive.org/services/img/nl-album-1");
assert.ok(loud.streamUrl.startsWith("https://archive.org/download/nl-album-1/"), "URL de descarga de IA");
assert.ok(loud.streamUrl.includes("Noise%20Waves/01%20-%20Loud%20City.mp3"), "URL con segmentos codificados");
assert.ok(loud.id.startsWith("ia-nl-album-1|"), "id con prefijo ia-");

const sea = tracks[1];
assert.strictEqual(sea.title, "Static Sea");
assert.strictEqual(sea.duration, 227, "'3:47' → 227 s");

const yodel = tracks[2];
assert.strictEqual(yodel.title, "Blue Yodel No. 1 (78rpm)", "objeto de una pista: título del objeto");
assert.strictEqual(yodel.artist, "Jimmie Rodgers");
assert.strictEqual(yodel.album, undefined, "una pista → sin álbum");
assert.strictEqual(yodel.duration, 170);
assert.ok(yodel.streamUrl.includes("blue-yodel.mp3"));

// 2) Salud: los fixtures respondieron → la fuente pasa a exigirse en las rutas
assert.strictEqual(archiveReachable(), true);

// 3) Búsqueda simple
const searchResults = await archiveSearch("Noise Waves", 15);
assert.ok(searchResults.length >= 1, "búsqueda devuelve resultados");

// 4) Resolución por título (la usa el reproductor)
const hit = await archiveResolve("static sea", "The Static Fields", 227);
assert.ok(hit, "debe resolver Static Sea");
assert.strictEqual(hit!.title, "Static Sea");
assert.strictEqual(hit!.duration, 227);

console.log("RESULTADO: OK — módulo Internet Archive verificado offline");
