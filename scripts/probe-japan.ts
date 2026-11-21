// Sondeo para la integración de radios japonesas (Fase 2 · Japón).
// Valida las tres fuentes accesibles desde este entorno:
//   1. Wikimedia Commons: consultas candidatas de música japonesa (60+ s).
//   2. Jamendo: tags japoneses con reintentos (el anti-abuso devuelve vacíos
//      intermitentes; el adaptador real usa 3 intentos con pausas).
//   3. Audius: búsquedas japonesas y cuántos resultados llevan CJK real.
// Ejecutar: bun scripts/probe-japan.ts
// ---------------------------------------------------------------

const UA = "VortexMusicApp/1.0 (reproductor web; contacto: vortexmusic.soporte.app@gmail.com)";
const JAM_UAS = [
  UA,
  "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
  "",
];
const CID = process.env.JAMENDO_CLIENT_ID || "e12d2d66";

function cjk(s: string): boolean {
  return /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uFF66-\uFF9D]/.test(s);
}

async function jget(url: string, ua = UA, timeoutMs = 15000): Promise<any> {
  const headers: Record<string, string> = ua === "" ? {} : { "User-Agent": ua };
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------- 1. Wikimedia Commons ----------
async function probeCommons(q: string): Promise<void> {
  const p = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${q} filetype:audio`,
    gsrnamespace: "6",
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url|mime|size|user",
    format: "json",
  });
  try {
    const d = await jget(`https://commons.wikimedia.org/w/api.php?${p}`);
    const pages: any[] = Object.values(d?.query?.pages ?? {});
    const playable = pages.filter((pg) => {
      const ii = pg.imageinfo?.[0];
      if (!ii) return false;
      const okMime = /audio|ogg/i.test(ii.mime ?? "");
      const secs = ii.duration ?? 0;
      return okMime && secs >= 60 && secs <= 1800;
    });
    console.log(`[commons] "${q}" → ${playable.length}/${pages.length} audios completos`);
    for (const pg of playable.slice(0, 3)) {
      const ii = pg.imageinfo[0];
      console.log(`    · ${pg.title?.replace(/^File:/, "").slice(0, 60)} (${Math.round(ii.duration)}s, ${ii.mime})`);
    }
  } catch (e) {
    console.log(`[commons] "${q}" → ERROR ${(e as Error).message}`);
  }
}

// ---------- 2. Jamendo por tags (con reintentos anti-abuso) ----------
async function probeJamTag(tag: string): Promise<void> {
  const qs = new URLSearchParams({
    client_id: CID,
    format: "json",
    limit: "10",
    audioformat: "mp32",
    include: "musicinfo",
    tags: tag,
    durationbetween: "60/1800",
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 900 + attempt * 700));
    try {
      const d = await jget(`https://api.jamendo.com/v3.0/tracks/?${qs}`, JAM_UAS[attempt % JAM_UAS.length]);
      const res: any[] = d.results ?? [];
      if (res.length > 0) {
        const jap = res.filter((r) => cjk(`${r.name ?? ""}${r.artist_name ?? ""}`)).length;
        console.log(`[jamendo] tags=${tag} → ${res.length} pistas (${jap} con CJK)`);
        for (const r of res.slice(0, 4)) console.log(`    · ${r.name?.slice(0, 48)} | ${r.artist_name}`);
        return;
      }
    } catch {
      /* reintento */
    }
  }
  console.log(`[jamendo] tags=${tag} → 0 (vacío tras 3 intentos)`);
}

// Igual pero por búsqueda libre (para "japanese traditional music" etc.)
async function probeJamSearch(q: string): Promise<void> {
  const qs = new URLSearchParams({
    client_id: CID,
    format: "json",
    limit: "10",
    audioformat: "mp32",
    include: "musicinfo",
    search: q,
    durationbetween: "60/1800",
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 900 + attempt * 700));
    try {
      const d = await jget(`https://api.jamendo.com/v3.0/tracks/?${qs}`, JAM_UAS[(attempt + 1) % JAM_UAS.length]);
      const res: any[] = d.results ?? [];
      if (res.length > 0) {
        console.log(`[jamendo] search="${q}" → ${res.length} pistas`);
        for (const r of res.slice(0, 4)) console.log(`    · ${r.name?.slice(0, 48)} | ${r.artist_name}`);
        return;
      }
    } catch {
      /* reintento */
    }
  }
  console.log(`[jamendo] search="${q}" → 0`);
}

// ---------- 3. Audius (búsquedas + proporción CJK) ----------
async function probeAudius(q: string): Promise<void> {
  const hosts = (await jget("https://api.audius.co")).data.filter((h: string) => h.startsWith("https://"));
  const host = hosts[Math.floor(Math.random() * hosts.length)];
  try {
    const d = await jget(`${host}/v1/tracks/search?query=${encodeURIComponent(q)}&limit=20&app_name=VortexMusic`);
    const list: any[] = (d.data ?? []).filter((t: any) => !t.is_delete && t.is_available !== false);
    const cjkN = list.filter((t: any) => cjk(`${t.title}${t.user?.name ?? ""}`)).length;
    console.log(`[audius] search="${q}" → ${list.length} pistas (${cjkN} con CJK)`);
    for (const t of list.filter((x: any) => cjk(`${x.title}${x.user?.name ?? ""}`)).slice(0, 3)) {
      console.log(`    · ${t.title.slice(0, 48)} | ${t.user?.name}`);
    }
    for (const t of list.filter((x: any) => !cjk(`${x.title}${x.user?.name ?? ""}`)).slice(0, 2)) {
      console.log(`    (no-CJK) ${t.title.slice(0, 44)} | ${t.user?.name}`);
    }
  } catch (e) {
    console.log(`[audius] search="${q}" → ERROR ${(e as Error).message}`);
  }
}

// ---------- ejecución ----------
const commonsQueries = [
  "shamisen", "koto music", "gagaku", "Japanese folk song",
  "Japanese traditional music", "minyo", "Japanese song", "biwa",
];
const jamTags = ["jpop", "jrock", "anime", "shamisen", "koto", "japan", "vocaloid"];
const jamSearches = ["japanese traditional music", "japanese folk song", "tokyo"];
const audiusQueries = ["vocaloid", "japan", "japanese", "j-pop", "anime"];

console.log("=== Wikimedia Commons (música japonesa) ===");
for (const q of commonsQueries) await probeCommons(q);

console.log("\n=== Jamendo por TAG ===");
for (const t of jamTags) await probeJamTag(t);

console.log("\n=== Jamendo por BÚSQUEDA ===");
for (const q of jamSearches) await probeJamSearch(q);

console.log("\n=== Audius ===");
for (const q of audiusQueries) await probeAudius(q);
