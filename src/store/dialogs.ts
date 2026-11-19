"use client";

import { create } from "zustand";
import type { Track } from "@/lib/music/types";

interface AddToPlaylistState {
  open: boolean;
  track: Track | null;
  openFor: (t: Track) => void;
  close: () => void;
}

export const useAddToPlaylist = create<AddToPlaylistState>((set) => ({
  open: false,
  track: null,
  openFor: (t) => set({ open: true, track: t }),
  close: () => set({ open: false, track: null }),
}));

interface CreatePlaylistState {
  open: boolean;
  openCreate: () => void;
  close: () => void;
}

export const useCreatePlaylistDialog = create<CreatePlaylistState>((set) => ({
  open: false,
  openCreate: () => set({ open: true }),
  close: () => set({ open: false }),
}));
