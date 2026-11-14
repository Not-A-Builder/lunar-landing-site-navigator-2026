import {
  Crosshair,
  Flag,
  Flask,
  GlobeHemisphereWest,
  Grains,
  Lightning,
  MapTrifold,
  Mountains,
  Path,
  Sun,
  Target,
  Tire,
  Toolbox,
  type Icon,
} from "@phosphor-icons/react";

/** Phosphor icon per metric category (replaces the sheet's emoji in the UI). */
const ICONS: Record<string, Icon> = {
  overall: Target,
  sun: Sun,
  earth: GlobeHemisphereWest,
  spatial: MapTrifold,
  terrain: Mountains,
  regolith: Grains,
  landing: Crosshair,
  trajectory: Path,
  science: Flask,
  logistics: Toolbox,
  rover: Tire,
  "space-weather": Lightning,
  heritage: Flag,
};

export function CategoryIcon({ id, size = 20 }: { id: string; size?: number }) {
  const I = ICONS[id] ?? Target;
  return <I size={size} className="shrink-0 text-muted" aria-hidden />;
}
