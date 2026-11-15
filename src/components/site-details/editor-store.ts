"use client";

import { create } from "zustand";

/**
 * Which planner editor is open on the site details page, and which field to bring into view.
 * Lets any value on the page ("Your input" values, rating bands) open the right editor at the right row.
 */
export type EditorTarget = { kind: "assumptions"; focus?: string } | { kind: "bands"; focus?: string };

export const useEditor = create<{ target: EditorTarget | null; open: (t: EditorTarget) => void; close: () => void }>()((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));
