export type TrackSource = "audius" | "openverse" | "ccmixter" | "wikimedia" | "jamendo" | "archive";

export interface Track {
  id: string; // "au-<audiusId>" | "ov-<openverseId>" | "ccm-<uploadId>" | "wm-<pageId>" | "jm-<jamendoId>" | "ia-<identifier>|<archivo>"
  source: TrackSource;
  origin?: string; // para openverse: "jamendo" | "wikimedia_audio"
  title: string;
  artist: string;
  artistId?: string; // id de artista para navegar a la vista (au-… / cc-… / ia-…)
  album?: string;
  artwork: string | null;
  duration: number; // segundos · duración ORIGINAL según el catálogo (0 si falta el metadato)
  streamUrl: string;
  preview: boolean; // siempre false: el catálogo de Vórtex es audio COMPLETO y legal
  genre?: string;
}

export interface Artist {
  id: string; // "au-<userId>" | "cc-<userName>" | "ia-<creator url-encoded>"
  name: string;
  artwork: string | null;
  genre?: string;
}

// Disco completo (hoy: objetos de Internet Archive con varias pistas; mañana
// cualquier fuente que exponga álbumes). Las pistas viajan en orden de disco.
export interface Album {
  id: string; // "ia-album-<identifier>" para Internet Archive
  source: TrackSource;
  title: string;
  artist: string;
  artistId?: string; // navegación al perfil del artista
  year?: string;
  artwork: string | null;
  trackCount: number;
  tracks: Track[]; // orden de disco (1, 2, 3…)
}

export interface HomePayload {
  trending: Track[];
  underground: Track[];
  fresh: Track[]; // novedades ccMixter (audio completo)
  ccTracks: Track[]; // sonidos libres de Openverse (Jamendo, Wikimedia)
  world: Track[]; // Rusia y China tradicionales · Wikimedia + Jamendo (audio completo)
}

export interface SearchPayload {
  songs: Track[];
  artists: Artist[];
  albums?: Album[]; // fuentes server-side con álbumes (hoy: solo IA client-side)
}

export interface ArtistDetail {
  artist: Artist;
  topSongs: Track[];
  albums?: Album[]; // discos del artista cuando la fuente los agrupa (IA)
}

export interface GenreDetail {
  label: string;
  tracks: Track[];
}
