// Mock de Internet Archive para verificar el circuito client-side de Vórtex
// Music en el sandbox (donde el archive.org real bloquea la IP con 429).
// Sirve respuestas con la MISMA forma que la API real:
//   · /advancedsearch.php?q=…        → { response: { docs: [...] } }
//   · /metadata/<identifier>         → { metadata: {...}, files: [...] }
//   · /download/<id>/<archivo>       → bytes MP3 (con soporte de Range)
//   · /services/img/<identifier>     → imagen PNG
//
// Réplica EXACTA del objeto real subido por el usuario a archive.org
// (verificado vía /metadata/2.-sombras-que-besan-la-luz):
//   · identifier: "2.-sombras-que-besan-la-luz"
//   · título: "Herida Eterna" · creador: "Jaguar Del Alba"
//   · colección: opensource_audio · mediatype: audio
//   · 12 MP3 (VBR MP3) SIN campo track y en ORDEN ALFABÉTICO, como entrega
//     files.xml de IA: "1.", "10.", "11.", "12.", "2.", "3."… y sin número al
//     final ("Pecados De La Medianoche.mp3"). El módulo debe ordenar el disco
//     1→12 leyendo el prefijo numérico del ARCHIVO y dejar el sin-número al
//     final, y debe aportar las 12 pistas (no un cap de 6).
//
// Uso: bun scripts/ia-mock.ts  (puerto 3999, cabeceras CORS abiertas)

declare const Bun: any; // script standalone: se ejecuta con `bun`, no con tsc

interface MockFile {
  name: string;
  format: string;
  length: string;
  size: string;
  track?: string;
  title?: string;
}

interface MockItem {
  metadata: {
    identifier: string;
    title: string;
    creator: string[];
    mediatype: string;
    collections: string[];
    date: string;
  };
  files: MockFile[];
  server: string;
  dir: string;
}

const PORT = 3999;

const ALBUM_ID = "2.-sombras-que-besan-la-luz";
const ALBUM_TITLE = "Herida Eterna";
const ALBUM_CREATOR = "Jaguar Del Alba";

// Pistas reales del objeto (nombre de archivo tal cual en IA). Duraciones y
// tamaños plausibles: la lógica del módulo no depende del valor exacto.
const ALBUM_TRACKS = [
  { name: "1.Ecos De Un Corazón En Llamas.mp3", length: "231.5", size: "7104320" },
  { name: "2.Sombras Que Besan La Luz.mp3", length: "204.11", size: "6289100" },
  { name: "3.Eternidad En Tus Ojos.mp3", length: "226.83", size: "6955620" },
  { name: "4.Cicatrices De Cristal Roto.mp3", length: "198.37", size: "6104233" },
  { name: "6.El Beso De La traición.mp3", length: "212.04", size: "6517940" },
  { name: "7.La Corona De La Serpiente.mp3", length: "243.9", size: "7499801" },
  { name: "8.Verdades Oxidadas.mp3", length: "189.56", size: "5829777" },
  { name: "9.Entre Lenguas De Veneno.mp3", length: "219.4", size: "6743472" },
  { name: "10.Susurros De Una Diosa Herida.mp3", length: "235.28", size: "7231489" },
  { name: "11.El Jardín De La Mujer Prohibida.mp3", length: "208.9", size: "6423734" },
  { name: "12.Juventud Devorada En Fuego.mp3", length: "194.75", size: "5987641" },
  { name: "Pecados De La Medianoche.mp3", length: "251.12", size: "7716875" },
];

// Ruido real del objeto: imágenes por pista, espectrogramas, miniatura y XML.
// El módulo debe descartarlos (no son MP3 o no tienen duración útil).
const ALBUM_NOISE = [
  { name: "1.Ecos De Un Corazón En Llamas.png", format: "PNG", length: "", size: "152340" },
  { name: "1.Ecos De Un Corazón En Llamas_spectrogram.png", format: "PNG", length: "", size: "88210" },
  { name: "2.Sombras Que Besan La Luz.png", format: "PNG", length: "", size: "161203" },
  { name: "__ia_thumb.jpg", format: "JPEG", length: "", size: "6120" },
  { name: `${ALBUM_ID}_files.xml`, format: "Metadata", length: "", size: "56000" },
  { name: `${ALBUM_ID}_meta.xml`, format: "Metadata", length: "", size: "3900" },
];

function albumMetadata(): MockItem {
  return {
    metadata: {
      identifier: ALBUM_ID,
      title: ALBUM_TITLE,
      creator: [ALBUM_CREATOR],
      mediatype: "audio",
      collections: ["opensource_audio"],
      date: "2025-09-14",
    },
    // Orden ALFABÉTICO como el files.xml real de IA (no el orden del disco).
    files: [
      ...ALBUM_TRACKS.map((t) => ({ ...t, format: "VBR MP3" })).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      ...ALBUM_NOISE,
    ],
    server: "ia-mock.local",
    dir: "/0/items/2.-sombras-que-besan-la-luz",
  };
}

const GENERIC_ITEMS: Record<string, MockItem> = {
  "netlabel-night-circuits-ep": {
    metadata: {
      identifier: "netlabel-night-circuits-ep",
      title: "Night Circuits EP",
      creator: ["Night Circuits"],
      mediatype: "audio",
      collections: ["netlabels"],
      date: "2024-03-02",
    },
    files: [
      { name: "1 - Neon Corridor.mp3", format: "VBR MP3", length: "243.9", size: "7402000", track: "1", title: "Neon Corridor" },
      { name: "2 - Signal Lost.mp3", format: "VBR MP3", length: "201.3", size: "6100300", track: "2", title: "Signal Lost" },
      { name: "cover.jpg", format: "JPEG", length: "", size: "81000" },
    ],
    server: "ia-mock.local",
    dir: "/0/items/netlabel-night-circuits-ep",
  },
  "live-summer-jam-1987": {
    metadata: {
      identifier: "live-summer-jam-1987",
      title: "Live at the River Amphitheater",
      creator: ["Summer Jam"],
      mediatype: "audio",
      collections: ["etree"],
      date: "1987-07-19",
    },
    files: [
      { name: "summerjam1987-01-opening.mp3", format: "VBR MP3", length: "312.5", size: "9450000", track: "1", title: "Opening Jam" },
      { name: "summerjam1987-02-drift.mp3", format: "VBR MP3", length: "268.7", size: "8123000", track: "2", title: "Drift" },
    ],
    server: "ia-mock.local",
    dir: "/0/items/live-summer-jam-1987",
  },
};

// ---------- bytes de audio ----------
const toneA = await Bun.file(new URL("./assets-mock/tono-prueba.mp3", import.meta.url)).arrayBuffer();
const toneB = await Bun.file(new URL("./assets-mock/tono2.mp3", import.meta.url)).arrayBuffer();

function audioFor(file: string): ArrayBuffer {
  return /pecados|sombras|10\./i.test(file) ? toneB : toneA;
}

// ---------- imagen 1x1 ----------
const PNG_1PX = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

// ---------- respuestas ----------
const ALL_ITEMS = [
  { identifier: ALBUM_ID, title: ALBUM_TITLE, creator: [ALBUM_CREATOR], year: "2025" },
  { identifier: "netlabel-night-circuits-ep", title: "Night Circuits EP", creator: ["Night Circuits"], year: "2024" },
  { identifier: "live-summer-jam-1987", title: "Live at the River Amphitheater", creator: ["Summer Jam"], year: "1987" },
];

function searchResponse(q: string) {
  const lower = q.toLowerCase();
  // Consulta de página de artista: creator:"…" (IA filtra por el campo exacto).
  const creatorMatch = /creator:\s*"([^"]+)"/i.exec(q);
  if (creatorMatch) {
    const c = creatorMatch[1].trim().toLowerCase();
    const docs = ALL_ITEMS.filter((d) => d.creator.some((x) => x.toLowerCase() === c));
    return { response: { numFound: docs.length, start: 0, docs } };
  }
  // Consultas de texto: "jaguar del alba", "herida eterna"…
  if (lower.includes("herida") || lower.includes("jaguar")) {
    const docs = ALL_ITEMS.filter((d) => d.identifier === ALBUM_ID);
    return { response: { numFound: docs.length, start: 0, docs } };
  }
  return {
    response: {
      numFound: 2,
      start: 0,
      docs: [
        { identifier: "netlabel-night-circuits-ep", title: "Night Circuits EP", creator: ["Night Circuits"], year: "2024" },
        { identifier: "live-summer-jam-1987", title: "Live at the River Amphitheater", creator: ["Summer Jam"], year: "1987" },
      ],
    },
  };
}

function metadataFor(identifier: string) {
  if (identifier === ALBUM_ID) return albumMetadata();
  return GENERIC_ITEMS[identifier] ?? null;
}

function cors(headers: Record<string, string>): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    ...headers,
  };
}

function json(body: unknown, callback?: string | null): Response {
  const text = JSON.stringify(body);
  const wrapped = callback ? `${callback}(${text});` : text;
  return new Response(wrapped, {
    headers: cors({
      "Content-Type": callback ? "text/javascript; charset=utf-8" : "application/json; charset=utf-8",
    }),
  });
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    console.log(`[ia-mock] ${req.method} ${path}${url.search}`);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors({}) });
    }

    if (path === "/advancedsearch.php") {
      const cb = url.searchParams.get("callback");
      const body = json(searchResponse(url.searchParams.get("q") ?? ""), cb);
      // NO_CORS=1 → advancedsearch SIN cabeceras CORS (como si IA no las
      // tuviera): obliga al módulo client-side a usar su fallback JSONP. El
      // pedido por <script> (callback) se responde igual, los script tags no
      // requieren CORS.
      if (process.env.NO_CORS === "1" && !cb) {
        return new Response(await body.text(), {
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      }
      return body;
    }

    const meta = path.match(/^\/metadata\/([^/]+)$/);
    if (meta) {
      const md = metadataFor(decodeURIComponent(meta[1]));
      return md ? json(md) : json({ error: "not found" });
    }

    const img = path.match(/^\/services\/img\/([^/]+)$/);
    if (img) {
      return new Response(PNG_1PX, { headers: cors({ "Content-Type": "image/png" }) });
    }

    const dl = path.match(/^\/download\/([^/]+)\/(.+)$/);
    if (dl) {
      const file = decodeURIComponent(dl[2]);
      const buf = audioFor(file);
      const range = req.headers.get("range");
      const baseHeaders = cors({
        "Content-Type": "audio/mpeg",
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      });
      if (range) {
        const m = /bytes=(\d+)-(\d*)/.exec(range);
        if (m) {
          const start = Number(m[1]);
          const end = m[2] ? Number(m[2]) : buf.byteLength - 1;
          const slice = buf.slice(start, end + 1);
          return new Response(slice, {
            status: 206,
            headers: {
              ...baseHeaders,
              "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`,
              "Content-Length": String(slice.byteLength),
            },
          });
        }
      }
      return new Response(buf, {
        headers: { ...baseHeaders, "Content-Length": String(buf.byteLength) },
      });
    }

    return new Response("ia-mock: ruta desconocida", { status: 404, headers: cors({}) });
  },
});

console.log(`[ia-mock] Internet Archive simulado en http://localhost:${PORT}`);
