// Servidor simulado de Internet Archive para verificar la UI de Vórtex con
// datos REALES del álbum "Herida Eterna" (obtenidos de archive.org vía
// WebFetch, porque el sandbox no puede llegar a archive.org directamente).
// Sirve advancedsearch.php y /metadata/* con CORS abierto.
// Ejecutar: bun scripts/ia-mock-server.ts  (puerto 9999)

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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json",
};

Bun.serve({
  port: 9999,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.includes("advancedsearch.php")) {
      return new Response(JSON.stringify(searchJson), { headers: CORS });
    }
    const m = /^\/metadata\/(.+)$/.exec(url.pathname);
    if (m) {
      const id = decodeURIComponent(m[1]);
      return new Response(JSON.stringify(metaJson[id] ?? {}), { headers: CORS });
    }
    return new Response("{}", { status: 404, headers: CORS });
  },
});

console.log("IA mock en http://localhost:9999");
