"use client";

import { Minus, Plus } from "@phosphor-icons/react";

/**
 * Bottom-left map controls shared by the polar, flat and 3D views: the
 * zoom buttons in the corner and, to their right, the pointer's selenographic coordinates (shown while
 * hovering the map, in Moon Trek's format).
 */
export function MapControls({ readoutRef, onZoomIn, onZoomOut }: { readoutRef: React.Ref<HTMLDivElement>; onZoomIn: () => void; onZoomOut: () => void }) {
  return (
    <div className="absolute bottom-2 left-2 z-10 flex items-end gap-2">
      <div className="flex flex-col overflow-hidden rounded-sm border border-line bg-panel text-fg shadow-sm">
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={onZoomIn} className="flex h-8 w-8 items-center justify-center hover:bg-panel-2">
          <Plus size={16} weight="bold" />
        </button>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={onZoomOut} className="flex h-8 w-8 items-center justify-center border-t border-line hover:bg-panel-2">
          <Minus size={16} weight="bold" />
        </button>
      </div>
      <div
        ref={readoutRef}
        aria-live="off"
        title="Pointer position: planetocentric latitude, east longitude"
        style={{ visibility: "hidden" }}
        className="num pointer-events-none whitespace-nowrap rounded-sm bg-panel/80 px-2 py-1 text-xs text-fg shadow-sm backdrop-blur-sm"
      />
    </div>
  );
}

/** Lon in east-positive [-180, 180). */
const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

export function fmtReadout(lat: number, lon: number) {
  return `Lat: ${lat.toFixed(5)}°, Lon: ${wrapLon(lon).toFixed(5)}°`;
}

/** Show the pointer position, or hide the readout (null). */
export function setReadout(el: HTMLDivElement | null, ll: { lat: number; lon: number } | null) {
  if (!el) return;
  if (!ll || !Number.isFinite(ll.lat) || !Number.isFinite(ll.lon) || Math.abs(ll.lat) > 90) {
    el.style.visibility = "hidden";
    return;
  }
  el.textContent = fmtReadout(ll.lat, ll.lon);
  el.style.visibility = "visible";
}
