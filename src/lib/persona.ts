"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The global 3-way view toggle. Same pages and functions for everyone; only the
 * representation and technical depth change (see the "views" columns of the metrics sheet).
 */
export const PERSONAS = [
  { id: "enthusiast", label: "Enthusiast", phrase: "an enthusiast", hint: "Plain-language story and visuals" },
  { id: "educator", label: "Educator", phrase: "an educator", hint: "Mechanisms, diagrams and the why" },
  { id: "planner", label: "Mission planner", phrase: "a mission planner", hint: "Numbers, timestamps, thresholds, uncertainty" },
] as const;

export type Persona = (typeof PERSONAS)[number]["id"];

type PersonaState = {
  persona: Persona;
  setPersona: (p: Persona) => void;
};

export const usePersona = create<PersonaState>()(
  persist(
    (set) => ({
      persona: "enthusiast",
      setPersona: (persona) => set({ persona }),
    }),
    // skipHydration: server always renders the default; <PersonaHydrator/> rehydrates on the client
    { name: "llsn-persona", skipHydration: true },
  ),
);
