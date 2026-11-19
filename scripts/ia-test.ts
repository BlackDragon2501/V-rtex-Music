// Test de lógica del módulo client-side de Internet Archive contra el mock
// local (scripts/ia-mock.ts en :3999). Verifica el caso real del usuario:
//   · buscar "Jaguar del Alba" → las 12 pistas del álbum (antes solo 6)
//   · orden natural del disco (1→12, sin-número al final)
//   · artistId para "Ir al artista" + tarjeta de artista en la búsqueda
//   · página de artista por creador (catálogo completo)
// Uso: NEXT_PUBLIC_IA_BASE=http://localhost:3999 bun scripts/ia-test.ts

process.env.NEXT_PUBLIC_IA_BASE = "http://localhost:3999";

// Import dinámico: el módulo lee NEXT_PUBLIC_IA_BASE al importarse.
const { iaBrowserSearch, iaBrowserArtists, iaBrowserArtistDetail } = await import(
  "../src/lib/music/ia-browser"
);

let fails = 0;
function check(label: string, cond: boolean, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"} · ${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) fails++;
}

async function main() {
  // 1) Búsqueda por artista: deben salir las 12 pistas COMPLETAS
  const songs = await iaBrowserSearch("Jaguar del Alba", 30);
  check("búsqueda 'Jaguar del Alba' devuelve 12 pistas", songs.length === 12, `→ ${songs.length}`);
  check(
    "todas con artistId ia-Jaguar%20Del%20Alba",
    songs.every((t) => t.artistId === "ia-Jaguar%20Del%20Alba")
  );
  check("todas del álbum Herida Eterna", songs.every((t) => t.album === "Herida Eterna"));
  const expectedOrder = [
    "Ecos De Un Corazón En Llamas",
    "Sombras Que Besan La Luz",
    "Eternidad En Tus Ojos",
    "Cicatrices De Cristal Roto",
    "El Beso De La traición",
    "La Corona De La Serpiente",
    "Verdades Oxidadas",
    "Entre Lenguas De Veneno",
    "Susurros De Una Diosa Herida",
    "El Jardín De La Mujer Prohibida",
    "Juventud Devorada En Fuego",
    "Pecados De La Medianoche",
  ];
  check(
    "orden natural del disco (prefijo del archivo, sin-número al final)",
    JSON.stringify(songs.map((t) => t.title)) === JSON.stringify(expectedOrder),
    `→ ${songs.map((t) => t.title).join(" | ")}`
  );
  check(
    "streamUrl apunta a /download con nombre codificado",
    songs.every(
      (t) =>
        t.streamUrl.startsWith("http://localhost:3999/download/2.-sombras-que-besan-la-luz/") &&
        !t.streamUrl.includes(" ")
    )
  );
  check("preview=false (audio completo)", songs.every((t) => t.preview === false));

  // 2) Búsqueda por álbum: mismas 12 pistas
  const byAlbum = await iaBrowserSearch("Herida Eterna", 30);
  check("búsqueda 'Herida Eterna' devuelve 12 pistas", byAlbum.length === 12, `→ ${byAlbum.length}`);

  // 3) Tarjeta de artista en la búsqueda
  const artists = await iaBrowserArtists("Jaguar del Alba", 6);
  check(
    "'Jaguar del Alba' genera 1 tarjeta de artista",
    artists.length === 1 && artists[0].name === "Jaguar Del Alba" && artists[0].id === "ia-Jaguar%20Del%20Alba",
    `→ ${JSON.stringify(artists.map((a) => a.name))}`
  );
  const noFake = await iaBrowserArtists("Herida Eterna", 6);
  check("'Herida Eterna' NO genera artista falso (regla estricta)", noFake.length === 0, `→ ${noFake.length}`);

  // 4) Página de artista: catálogo completo del creador
  const detail = await iaBrowserArtistDetail(artists[0].id);
  check(
    "página de artista 'Jaguar Del Alba' → 12 pistas",
    detail.topSongs.length === 12,
    `→ ${detail.topSongs.length}`
  );
  check(
    "artista de la página con artwork",
    detail.artist.name === "Jaguar Del Alba" && !!detail.artist.artwork
  );

  // 5) Búsqueda genérica: cap de diversidad intacto (2 objetos × pistas)
  const generic = await iaBrowserSearch("night circuits", 30);
  check(
    "búsqueda genérica trae objetos variados",
    generic.length === 4 && new Set(generic.map((t) => t.artist)).size === 2,
    `→ ${generic.length} pistas de ${new Set(generic.map((t) => t.artist)).size} creadores`
  );

  // 6) Artista inexistente → error claro (la vista muestra su estado de error)
  let threw = false;
  try {
    await iaBrowserArtistDetail("ia-Fantasma%20Inexistente");
  } catch {
    threw = true;
  }
  check("artista IA sin audio lanza error (vista con reintento)", threw);

  console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLOS`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});

export {}; // módulo TS: permite el await de nivel superior del import dinámico
