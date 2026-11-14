"use client";

import { useEffect } from "react";
import { useAssumptions } from "@/lib/assumptions-store";
import { PERSONAS, usePersona } from "@/lib/persona";

/** Rehydrates persisted persona + assumptions after first paint (avoids SSR/client mismatch). */
export function PersonaHydrator() {
  useEffect(() => {
    usePersona.persist.rehydrate();
    useAssumptions.persist.rehydrate();
  }, []);
  return null;
}

/** Global view switcher, modelled on Google Docs' Viewing/Suggesting/Editing control. */
export function PersonaToggle() {
  const persona = usePersona((s) => s.persona);
  const setPersona = usePersona((s) => s.setPersona);

  return (
    <div role="radiogroup" aria-label="Information level" className="flex rounded-sm border border-line bg-panel p-0.5 text-sm">
      {PERSONAS.map((p) => {
        const active = p.id === persona;
        return (
          <button
            key={p.id}
            role="radio"
            aria-checked={active}
            title={p.hint}
            onClick={() => setPersona(p.id)}
            className={`rounded-sm px-3 py-1 transition-colors ${
              active ? "bg-primary text-primary-ink" : "text-muted hover:text-fg"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
