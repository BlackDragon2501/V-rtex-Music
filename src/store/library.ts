"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Track } from "@/lib/music/types";

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  tracks: Track[];
  createdAt: number;
  gradient: number; // índice de la paleta de portadas
}

interface LibraryState {
  likedTracks: Track[];
  playlists: Playlist[];
  recentlyPlayed: Track[];
  likeTrack: (t: Track) => void;
  unlikeTrack: (id: string) => void;
  toggleLike: (t: Track) => boolean; // devuelve true si quedó "me gusta"
  isLiked: (id: string) => boolean;
  createPlaylist: (name: string, tracks?: Track[], description?: string) => Playlist;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  addTrackToPlaylist: (id: string, t: Track) => "added" | "exists";
  removeTrackFromPlaylist: (id: string, trackId: string) => void;
  addRecentlyPlayed: (t: Track) => void;
}

const MAX_RECENT = 30;

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      likedTracks: [],
      playlists: [],
      recentlyPlayed: [],
      likeTrack: (t) => {
        if (get().likedTracks.some((x) => x.id === t.id)) return;
        set((s) => ({ likedTracks: [t, ...s.likedTracks] }));
      },
      unlikeTrack: (id) =>
        set((s) => ({ likedTracks: s.likedTracks.filter((x) => x.id !== id) })),
      toggleLike: (t) => {
        const liked = get().likedTracks.some((x) => x.id === t.id);
        if (liked) {
          get().unlikeTrack(t.id);
          return false;
        }
        get().likeTrack(t);
        return true;
      },
      isLiked: (id) => get().likedTracks.some((x) => x.id === id),
      createPlaylist: (name, tracks = [], description) => {
        const pl: Playlist = {
          id: `pl-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          name: name.trim() || "Mi playlist",
          description: description?.trim() || undefined,
          tracks,
          createdAt: Date.now(),
          gradient: Math.floor(Math.random() * 6),
        };
        set((s) => ({ playlists: [pl, ...s.playlists] }));
        return pl;
      },
      deletePlaylist: (id) =>
        set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),
      renamePlaylist: (id, name) =>
        set((s) => ({
          playlists: s.playlists.map((p) => (p.id === id ? { ...p, name } : p)),
        })),
      addTrackToPlaylist: (id, t) => {
        const pl = get().playlists.find((p) => p.id === id);
        if (!pl) return "added";
        if (pl.tracks.some((x) => x.id === t.id)) return "exists";
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === id ? { ...p, tracks: [...p.tracks, t] } : p
          ),
        }));
        return "added";
      },
      removeTrackFromPlaylist: (id, trackId) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === id ? { ...p, tracks: p.tracks.filter((x) => x.id !== trackId) } : p
          ),
        })),
      addRecentlyPlayed: (t) => {
        const rest = get().recentlyPlayed.filter((x) => x.id !== t.id);
        set({ recentlyPlayed: [t, ...rest].slice(0, MAX_RECENT) });
      },
    }),
    {
      name: "vortex-library",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
