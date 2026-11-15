"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { newVisitId, scenariosAt, useHistory } from "@/lib/history";

/** True once the persisted history has loaded, so a new entry never gets overwritten by the stored list. */
export function useHistoryHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const done = () => setHydrated(true);
    const unsub = useHistory.persist.onFinishHydration(done);
    if (useHistory.persist.hasHydrated()) done();
    else void useHistory.persist.rehydrate();
    // Another tab changed the history: pick it up.
    const onStorage = (e: StorageEvent) => {
      if (e.key === useHistory.persist.getOptions().name) void useHistory.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return hydrated;
}

/**
 * Adds every opened site details page and comparison to History (D-131). One stay on a page is one entry:
 * changing the landing time or removing a scenario there updates it; opening the page again adds a new one.
 */
export function HistoryRecorder() {
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString();
  const hydrated = useHistoryHydrated();
  const visit = useRef<{ pathname: string; id: string } | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const scenarios = scenariosAt(pathname, new URLSearchParams(search), Date.now());
    if (!scenarios) {
      visit.current = null;
      return;
    }
    if (visit.current?.pathname !== pathname) visit.current = { pathname, id: newVisitId() };
    useHistory.getState().record(scenarios, visit.current.id, Date.now());
  }, [hydrated, pathname, search]);

  return null;
}
