"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_ASSUMPTIONS, type Assumptions } from "./assumptions";
import type { BandKey, BandOverride, BandOverrides } from "./bands";

type State = {
  a: Assumptions;
  bands: BandOverrides;
  set: <K extends keyof Assumptions>(k: K, v: Assumptions[K]) => void;
  /** replace every assumption at once (the editor's "Save changes") */
  setAll: (a: Assumptions) => void;
  /** replace every band override at once (the editor's "Save changes") */
  setAllBands: (b: BandOverrides) => void;
  setBand: (k: BandKey, v: BandOverride) => void;
  resetBand: (k: BandKey) => void;
  reset: () => void;
  resetBands: () => void;
};

/** Planner inputs: mission assumptions and rating-band overrides (persisted per browser). */
export const useAssumptions = create<State>()(
  persist(
    (set) => ({
      a: DEFAULT_ASSUMPTIONS,
      bands: {},
      set: (k, v) => set((s) => ({ a: { ...s.a, [k]: v } })),
      setAll: (a) => set({ a: { ...a } }),
      setAllBands: (bands) => set({ bands: { ...bands } }),
      setBand: (k, v) => set((s) => ({ bands: { ...s.bands, [k]: v } })),
      resetBand: (k) => set((s) => {
        const next = { ...s.bands };
        delete next[k];
        return { bands: next };
      }),
      reset: () => set({ a: DEFAULT_ASSUMPTIONS }),
      resetBands: () => set({ bands: {} }),
    }),
    {
      name: "llsn-assumptions",
      skipHydration: true,
      // v1 (D-084): the default mission grew from 14 to 30 days; an untouched old default moves with it.
      version: 1,
      migrate: (persisted, from) => {
        const p = (persisted ?? {}) as Partial<State>;
        if (from < 1 && p.a && p.a.missionDays === 14) p.a = { ...p.a, missionDays: 30 };
        return p as State;
      },
      merge: (persisted, current) => {
        const p = (persisted as Partial<State>) ?? {};
        return { ...current, a: { ...DEFAULT_ASSUMPTIONS, ...(p.a ?? {}) }, bands: p.bands ?? {} };
      },
    },
  ),
);
