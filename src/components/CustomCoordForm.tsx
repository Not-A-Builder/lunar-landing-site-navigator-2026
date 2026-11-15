"use client";

import { useState } from "react";
import { InfoTip } from "@/components/InfoTip";
import { parseCoordString } from "@/lib/coords";
import { btnPrimary } from "@/lib/ui";
import { fmtLat, fmtLon } from "@/lib/metrics/format";

/**
 * Enter any lunar coordinate ("85.2S 30.1E", "-85.2, 30.1", "-89.45 230.22"). Terrain for a custom point is
 * computed on the server from LOLA elevation data; Sun/Earth geometry from the JPL Horizons tables.
 */
export function CustomCoordForm({
  onSubmit,
  initial,
  submitLabel = "Analyse",
  compact,
}: {
  onSubmit: (lat: number, lon: number) => void;
  initial?: { lat: number; lon: number } | null;
  submitLabel?: string;
  compact?: boolean;
}) {
  const [text, setText] = useState(initial ? `${initial.lat}, ${initial.lon}` : "");
  const [error, setError] = useState<string | null>(null);
  const parsed = text.trim() ? parseCoordString(text) : null;
  const submit = () => {
    const p = parseCoordString(text);
    if (!p.ok) return setError(p.error);
    setError(null);
    onSubmit(p.lat, p.lon);
  };
  return (
    <form
      className={compact ? "space-y-1" : "space-y-1.5"}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {!compact && (
        <label htmlFor="custom-coord" className="flex items-center text-sm text-muted">
          Any point on the Moon (lat, lon)
          <InfoTip title="Custom coordinates" sources={["lola-pds", "jpl-horizons", "usgs-gazetteer", "psr-atlas"]}>
            Type latitude then longitude, for example 85.2S 30.1E, -85.2, 30.1, or -89.45 230.22 (east longitude 0–360). You can also click the map. The terrain horizon, slopes and nearby features are computed for that exact point from LOLA elevation data, which takes a few seconds the first time.
          </InfoTip>
        </label>
      )}
      <div className="flex items-center gap-2">
        <input
          id="custom-coord"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          placeholder="e.g. 85.2S 30.1E"
          aria-invalid={!!error}
          className={`num h-10 min-w-0 flex-1 rounded-sm border bg-panel px-2.5 text-sm placeholder:font-sans placeholder:text-faint ${error ? "border-critical" : "border-line"}`}
        />
        <button type="submit" className={btnPrimary}>{submitLabel}</button>
      </div>
      {error ? (
        <p className="text-xs text-critical">{error}</p>
      ) : parsed?.ok ? (
        <p className="text-xs text-faint">Reads as <span className="num">{fmtLat(parsed.lat)}, {fmtLon(parsed.lon)}</span></p>
      ) : null}
    </form>
  );
}
