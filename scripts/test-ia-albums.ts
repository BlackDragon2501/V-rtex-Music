// Test de lógica IA: álbumes, filtro estricto y detalle de disco.
// Usa datos REALES del álbum "Herida Eterna" (Jaguar Del Alba) obtenidos de
// archive.org/metadata/2.-sombras-que-besan-la-luz, con fetch simulado.
// Ejecutar: bun scripts/test-ia-albums.ts

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  OK  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}`, extra ?? "");
  }
}

// ---------- fetch simulado ----------
const ALBUM_ID = "2.-sombras-que-besan-la-luz";

function mp3(name: string, length: number) {
  return { name, format: "VBR MP3", length, size: 7000000 };
}

const albumFiles = [
  mp3("1.Ecos De Un Corazón En Llamas.mp3", 306.48),
  mp3("2.Sombras Que Besan La Luz.mp3", 354.12),
  mp3("3.Eternidad En Tus Ojos.mp3", 277.83),
  mp3("4.Cicatrices De Cristal Roto.mp3", 360.84),
  mp3("6.El Beso De La traición.mp3", 314.78),
  mp3("7.La Corona De La Serpiente.mp3", 267),
  mp3("8.Verdades Oxidadas.mp3", 348.6),
  mp3("9.Entre Lenguas De Veneno.mp3", 320.35),
  mp3("10.Susurros De Una Diosa Herida.mp3", 349.92),
  mp3("11.El Jardín De La Mujer Prohibida.mp3", 336.55),
  mp3("12.Juventud Devorada En Fuego.mp3", 308.64),
  mp3("Pecados De La Medianoche.mp3", 279.96),
];

const searchJson = {
  response: {
    numFound: 2,
    docs: [
      { identifier: ALBUM_ID, title: "Herida Eterna", creator: "Jaguar Del Alba", year: "2025" },
      // Ruido de búsqueda típico: otro artista que coincide a medias.
      { identifier: "noise-item", title: "Fiesta Alba", creator: "DJ Prueba", year: "2019" },
    ],
  },
};

const metaJson: Record<string, unknown> = {
  [ALBUM_ID]: {
    metadata: { title: "Herida Eterna", creator: "Jaguar Del Alba", album: "Herida Eterna", date: "2025" },
    files: albumFiles,
  },
  "noise-item": {
    metadata: { title: "Fiesta Alba", creator: "DJ Prueba" },
    files: [mp3("Fiesta Alba.mp3", 200)],
  },
};

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("advancedsearch.php")) return new Response(JSON.stringify(searchJson), { headers: { "Content-Type": "application/json" } });
  const m = /\/metadata\/([^/?]+)/.exec(url);
  if (m) {
    const body = metaJson[decodeURIComponent(m[1])];
    return new Response(JSON.stringify(body ?? {}), { headers: { "Content-Type": "application/json" } });
  }
  return new Response("not found", { status: 404 });
}) as typeof fetch;

// ---------- pruebas ----------
const {
  iaBrowserBundle,
  iaBrowserAlbums,
  iaBrowserArtists,
  iaBrowserAlbumDetail,
  iaBrowserArtistDetail,
} = await import("../src/lib/music/ia-browser");
const { trackMatchesQuery } = await import("../src/lib/music/match");

console.log("· iaBrowserBundle('Jaguar del Alba')");
const bundle = await iaBrowserBundle("Jaguar del Alba", 40);
check("13 pistas crudas (12 del disco + 1 ruido)", bundle.tracks.length === 13, bundle.tracks.length);
check("12 pistas son del artista Jaguar Del Alba", bundle.tracks.filter((t) => t.artist === "Jaguar Del Alba").length === 12);
check("ninguna pista del disco pierde el campo album 'Herida Eterna'", bundle.tracks.filter((t) => t.album === "Herida Eterna").length === 12);
check("1 álbum detectado", bundle.albums.length === 1, bundle.albums.map((a) => a.title));
check("álbum 'Herida Eterna' con 12 pistas", bundle.albums[0]?.title === "Herida Eterna" && bundle.albums[0]?.trackCount === 12);
check("álbum con artistId navegable", bundle.albums[0]?.artistId === `ia-${encodeURIComponent("Jaguar Del Alba")}`);
check("1 artista detectado (el ruido no pasa)", bundle.artists.length === 1 && bundle.artists[0]?.name === "Jaguar Del Alba");

console.log("· orden de disco en el álbum");
const order = bundle.albums[0]!.tracks.map((t) => t.title);
check("posición 0 = 'Ecos De Un Corazón En Llamas'", /^Ecos/.test(order[0] ?? ""), order[0]);
check("posición 1 = 'Sombras Que Besan La Luz'", /^Sombras/.test(order[1] ?? ""), order[1]);
check("última = 'Pecados De La Medianoche' (sin número → al final)", /Pecados/.test(order[order.length - 1] ?? ""), order[order.length - 1]);
check("IDs únicos (sin duplicados de derivados)", new Set(bundle.albums[0]!.tracks.map((t) => t.id)).size === 12);

console.log("· streamUrl apunta al MP3 real");
const first = bundle.albums[0]!.tracks[0]!;
check("streamUrl /download/<id>/<archivo>", first.streamUrl === `https://archive.org/download/${ALBUM_ID}/${encodeURIComponent("1.Ecos De Un Corazón En Llamas.mp3")}`, first.streamUrl);
check("duración ≈ 306 s", Math.abs(first.duration - 306) <= 1, first.duration);

console.log("· iaBrowserAlbumDetail");
const detail = await iaBrowserAlbumDetail(`ia-album-${ALBUM_ID}`);
check("12 pistas en la vista del disco", detail.tracks.length === 12, detail.tracks.length);
check("album.title 'Herida Eterna'", detail.album.title === "Herida Eterna");
check("album.year '2025'", detail.album.year === "2025");

console.log("· iaBrowserAlbums / iaBrowserArtists (compatibles)");
check("iaBrowserAlbums → 1", (await iaBrowserAlbums("Jaguar del Alba")).length === 1);
check("iaBrowserArtists('Jaguar del Alba') → Jaguar Del Alba", (await iaBrowserArtists("Jaguar del Alba"))[0]?.name === "Jaguar Del Alba");
// Buscar por el NOMBRE DEL DISCO también debe surface al artista:
check("iaBrowserArtists('Herida Eterna') → Jaguar Del Alba", (await iaBrowserArtists("Herida Eterna"))[0]?.name === "Jaguar Del Alba");
check("iaBrowserArtists('Fiesta Alba') NO trae al ruido", !(await iaBrowserArtists("Fiesta Alba")).some((a) => a.name === "Jaguar Del Alba"));

console.log("· página de artista con álbumes");
const artistDetail = await iaBrowserArtistDetail(`ia-${encodeURIComponent("Jaguar Del Alba")}`);
check("topSongs 12", artistDetail.topSongs.length === 12, artistDetail.topSongs.length);
check("albums 1 (el ruido es de otro creador)", artistDetail.albums?.length === 1, artistDetail.albums?.map((a) => a.title));

console.log("· filtro estricto trackMatchesQuery");
const jaguarTrack = { title: "Sombras Que Besan La Luz", artist: "Jaguar Del Alba", album: "Herida Eterna" };
const noiseTrack = { title: "Fiesta Alba", artist: "DJ Prueba" };
check("'Jaguar del Alba' SÍ pasa para el disco de Jaguar", trackMatchesQuery("Jaguar del Alba", jaguarTrack) === true);
check("'Jaguar del Alba' NO pasa para el ruido de otro artista", trackMatchesQuery("Jaguar del Alba", noiseTrack) === false);
check("'Herida Eterna' pasa por el campo álbum", trackMatchesQuery("Herida Eterna", jaguarTrack) === true);
check("título de pista ('Sombras Que Besan La Luz') pasa", trackMatchesQuery("Sombras Que Besan La Luz", jaguarTrack) === true);
check("sin acentos: 'El Beso De La Traicion' pasa para 'El Beso De La traición'", trackMatchesQuery("El Beso De La Traicion", { title: "El Beso De La traición", artist: "Jaguar Del Alba", album: "Herida Eterna" }) === true);
check("término único ('Rock') no recorta nada", trackMatchesQuery("Rock", noiseTrack) === true);

globalThis.fetch = realFetch;
console.log(failures === 0 ? "\nTODO OK" : `\n${failures} FALLOS`);
process.exit(failures === 0 ? 0 : 1);
