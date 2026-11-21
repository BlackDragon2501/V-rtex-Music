// Radios por género: cada género alimenta de varias fuentes LEGALES con audio
// COMPLETO (sin avances): Audius, Openverse (Jamendo/Wikimedia), ccMixter
// directo, Jamendo directo y Wikimedia Commons.
//
// Campos opcionales:
//   · audius    → género nativo de Audius
//   · cc        → consulta en Openverse (catálogo Jamendo + Wikimedia)
//   · ccm       → etiqueta en ccMixter
//   · wiki      → búsqueda de texto en Wikimedia Commons
//   · jam       → búsqueda en Jamendo directo (client_id gratuito en .env;
//                 sin client_id cae a Openverse filtrado a Jamendo)
//   · ia        → consulta en Internet Archive (netlabels CC y discos
//                 históricos de libre distribución: netlabels, opensource_audio,
//                 78rpms, georgeblood); fuente OPCIONAL con degradación suave
//   · wikiLang  → consultas dedicadas por idioma en Commons ("ru" | "cn" | "jp"),
//                 verificadas con grabaciones completas reales
//   · jamTag    → etiqueta nativa de Jamendo (tags=jpop…): la vía directa para
//                 los géneros japoneses que Jamendo indexa por su propio tag
//   · auJapan → búsqueda japonesa en Audius con filtro de guion japonés (CJK):
//                 solo pistas genuinamente japonesas (ver probe-japan.ts).
//                 `true` = consultas base (vocaloid/j-pop/j-rock/japan);
//                 string[] = consultas específicas de la radio (anime: touhou,
//                 utau, anime cover — doujin verificado en Audius).
export const GENRES: Record<
  string,
  {
    label: string;
    audius?: string;
    cc?: string;
    ccm?: string;
    wiki?: string;
    jam?: string;
    ia?: string;
    wikiLang?: "ru" | "cn" | "jp";
    jamTag?: string;
    auJapan?: boolean | string[];
  }
> = {
  reggaeton: { label: "Reggaetón", audius: "Reggaeton", cc: "reggaeton beat", ccm: "latin", wiki: "reggaeton" },
  "pop-latino": { label: "Pop Latino", cc: "latin pop", ccm: "latin", wiki: "latin pop" },
  pop: { label: "Pop", audius: "Pop", cc: "pop vocals", ccm: "pop", wiki: "pop music", ia: "pop" },
  rock: { label: "Rock", audius: "Rock", cc: "rock band", ccm: "rock", wiki: "rock", ia: "rock" },
  metal: { label: "Metal", audius: "Metal", cc: "heavy metal", ccm: "hard rock", wiki: "heavy metal", jam: "metal", ia: "metal" },
  electronica: { label: "Electrónica", audius: "Electronic", cc: "electronic dance music", ccm: "electronic", wiki: "electronic music", ia: "electronic" },
  "hip-hop": { label: "Hip-Hop", audius: "Hip-Hop/Rap", cc: "hip hop beat", ccm: "rap", wiki: "hip hop", ia: "hip hop" },
  salsa: { label: "Salsa", cc: "salsa latin", ccm: "latin", wiki: "salsa" },
  cumbia: { label: "Cumbia", cc: "cumbia", ccm: "latin", wiki: "cumbia" },
  "lo-fi": { label: "Lo-Fi", audius: "Lo-Fi", cc: "lofi chill beat", ccm: "chill", wiki: "lo-fi hip hop", ia: "lofi" },
  jazz: { label: "Jazz", audius: "Jazz", cc: "jazz trio", ccm: "jazz", wiki: "jazz", ia: "jazz" },
  "k-pop": { label: "K-Pop", cc: "k pop dance", ccm: "pop", wiki: "k-pop" },
  clasica: { label: "Clásica", audius: "Classical", cc: "classical piano orchestra", ccm: "classical", wiki: "classical music", ia: "classical" },
  indie: { label: "Indie", audius: "Indie", cc: "indie folk", ccm: "indie", wiki: "indie rock", ia: "indie" },
  trance: { label: "Trance", audius: "Trance", cc: "trance", ccm: "trance", wiki: "trance music", ia: "trance" },
  dubstep: { label: "Dubstep", audius: "Dubstep", cc: "dubstep", ccm: "dubstep", wiki: "dubstep", ia: "dubstep" },
  // Radios por idioma (fase R1 + C1/R4 + JP): audio completo y legal verificado.
  ruso: { label: "Rusia", jam: "russian folk song", cc: "russian folk song", wikiLang: "ru" },
  china: { label: "China tradicional", jam: "chinese traditional music", cc: "chinese traditional", wikiLang: "cn" },
  // Japón (Fase 2 · JP): todo tipo de música japonesa legal y completa.
  //  · j-pop: tag nativo jpop de Jamendo (verificado con títulos en japonés),
  //    Audius filtrado por guion japonés y Commons. SIN fuente Openverse por
  //    texto: la búsqueda libre de Openverse arrastraba ruido no japonés
  //    (portugués, italiano, azerí) que solo MENCIONA "japanese pop" en
  //    metadatos; el tag de Jamendo y el filtro CJK de Audius son la vía precisa.
  //  · j-rock / anime: mismo esquema.
  //  · anime: música anime/doujin/vocaloid LIBERADA por sus autores (CC) —
  //    nunca openings con copyright: solo lo que publicaron sus creadores.
  //    Audius: consultas doujin verificadas (sondeo 2026): "anime cover" trae
  //    covers con títulos en japonés (NEOWOLX, HUNTER×HUNTER), "touhou" trae
  //    arreglos 東方 con guion japonés y "utau" covers UTAU 【…カバー】.
  //  · japon-tradicional: Commons verificado (min'yo, shamisen, Hotaru no
  //    Hikari), 78rpm japoneses de dominio público en Internet Archive y
  //    tradicional en Jamendo. IA es OPCIONAL (degradación si no responde).
  //    jamTag "japan" en vez de "shamisen": el tag shamisen de Jamendo es
  //    RUIDO (sondeo 2026: "Pantera Japanese Trap", artistas cirílicos);
  //    "japan" aporta contenido de tema japonés real (Sakura, Kisarazu,
  //    Oriental Music Library) y deja el núcleo tradicional a Commons.
  "j-pop": { label: "J-Pop", auJapan: true, jamTag: "jpop", wikiLang: "jp" },
  "j-rock": { label: "J-Rock", auJapan: true, jamTag: "jrock", wikiLang: "jp" },
  anime: { label: "Anime & Vocal", auJapan: ["anime cover", "touhou", "utau"], jamTag: "anime", wikiLang: "jp" },
  "japon-tradicional": {
    label: "Japón tradicional",
    jamTag: "japan",
    jam: "japanese traditional music",
    wikiLang: "jp",
    ia: "language:(japanese)",
  },
};
