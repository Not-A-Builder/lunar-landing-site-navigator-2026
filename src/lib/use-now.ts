"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};
const hourNow = () => {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  return d.getTime();
};

/** Current UTC hour (ms) on the client, null during server render, so SSR and hydration agree. */
export function useNowHour(): number | null {
  return useSyncExternalStore(noop, hourNow, () => null);
}
