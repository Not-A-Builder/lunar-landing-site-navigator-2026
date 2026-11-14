"use client";

import { useEffect, useRef } from "react";
import "ol/ol.css";
import type OlMap from "ol/Map";
import type VectorLayer from "ol/layer/Vector";
import type VectorSource from "ol/source/Vector";
import { GLOBAL_MAP, POLAR_MAP, SOUTH_POLAR_PROJ, type MapLayerConfig } from "@/lib/moon";
import type { Site } from "@/lib/sites";
import { cssVar, useTheme } from "@/lib/theme";

type Palette = { accent: string; fg: string; muted: string; label: string; halo: string; selected: string };
const readPalette = (): Palette => ({ accent: cssVar("--accent"), fg: cssVar("--fg"), muted: cssVar("--muted"), label: cssVar("--map-label"), halo: cssVar("--map-halo"), selected: cssVar("--warning") });
/** "#rrggbb" + alpha → rgba() for OpenLayers fills. */
const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export type MapMode = "polar" | "global";

type Props = {
  mode: MapMode;
  sites: Site[];
  hoveredId: string | null;
  selectedIds?: string[];
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onPickCoordinate?: (lat: number, lon: number) => void;
  /** a user-picked point shown with its own marker; clicking it calls onSelect("__custom") */
  customPoint?: { lat: number; lon: number } | null;
};

/**
 * Moon map on NASA Moon Trek tiles. Polar mode: south polar stereographic. Global mode:
 * equirectangular. Hover is two-way: list → pin via `hoveredId`, pin → list via `onHover`.
 */
export function MoonMap({ mode, sites, hoveredId, selectedIds = [], onHover, onSelect, onPickCoordinate, customPoint = null }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);
  const layerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const toXYRef = useRef<((lat: number, lon: number) => number[]) | null>(null);
  const stateRef = useRef({ hoveredId, selectedIds, onHover, onSelect, onPickCoordinate });
  const sitesRef = useRef(sites);
  const customRef = useRef(customPoint);
  const theme = useTheme();
  const paletteRef = useRef<Palette | null>(null);
  const featureModRef = useRef<{ Feature: typeof import("ol/Feature").default; Point: typeof import("ol/geom/Point").default; Polygon: typeof import("ol/geom/Polygon").default } | null>(null);

  useEffect(() => {
    stateRef.current = { hoveredId, selectedIds, onHover, onSelect, onPickCoordinate };
    layerRef.current?.changed();
  }, [hoveredId, selectedIds, onHover, onSelect, onPickCoordinate]);

  // Create the map once per mode.
  useEffect(() => {
    let disposed = false;
    (async () => {
      const [
        { default: Map }, { default: View }, { default: TileLayer }, { default: XYZ }, { default: TileGrid },
        { default: VectorLayerC }, { default: VectorSourceC }, { default: Feature }, { default: Point }, { default: Polygon },
        proj4Mod, olProj4, olProj, style,
      ] = await Promise.all([
        import("ol/Map"), import("ol/View"), import("ol/layer/Tile"), import("ol/source/XYZ"), import("ol/tilegrid/TileGrid"),
        import("ol/layer/Vector"), import("ol/source/Vector"), import("ol/Feature"), import("ol/geom/Point"), import("ol/geom/Polygon"),
        import("proj4"), import("ol/proj/proj4"), import("ol/proj"), import("ol/style"),
      ]);
      if (disposed || !el.current) return;
      featureModRef.current = { Feature, Point, Polygon };
      const proj4 = proj4Mod.default;
      const cfg: MapLayerConfig = mode === "polar" ? POLAR_MAP : GLOBAL_MAP;
      proj4.defs(SOUTH_POLAR_PROJ.code, SOUTH_POLAR_PROJ.proj4);
      proj4.defs("MOON:EQC", "+proj=longlat +R=1737400 +no_defs");
      olProj4.register(proj4);
      const projection = olProj.get(cfg.projection)!;
      projection.setExtent(cfg.projExtent);
      if (cfg.projection === "MOON:EQC") projection.setGlobal?.(true);
      const toXY = (lat: number, lon: number) => proj4("EPSG:4326", cfg.projection, [lon, lat]);
      toXYRef.current = toXY;

      const resolutions = Array.from({ length: cfg.maxLevel + 1 }, (_, z) => cfg.level0Resolution / 2 ** z);
      const tileLayers = cfg.layers.map(
        (l) =>
          new TileLayer({
            source: new XYZ({
              projection,
              tileGrid: new TileGrid({ origin: cfg.origin, resolutions: resolutions.slice(0, l.maxZoom + 1), tileSize: cfg.tileSize, extent: l.extent }),
              url: l.url,
              attributions: cfg.attribution,
              crossOrigin: "anonymous",
            }),
            extent: l.extent,
          }),
      );

      const pin = (color: string, r: number, ring: string) =>
        new style.Circle({ radius: r, fill: new style.Fill({ color }), stroke: new style.Stroke({ color: ring, width: 2 }) });
      const layer = new VectorLayerC({
        source: new VectorSourceC(),
        style: (f) => {
          const id = String(f.get("siteId"));
          const s = stateRef.current;
          const hot = s.hoveredId === id;
          const sel = s.selectedIds.includes(id);
          const kind = f.get("kind");
          const p = (paletteRef.current ??= readPalette());
          const font = `600 14px ${cssVar("--font-plex-sans") || "system-ui"}, sans-serif`;
          if (kind === "custom") {
            return new style.Style({
              image: new style.Circle({ radius: hot ? 10 : 9, fill: new style.Fill({ color: alpha(p.halo, 0.25) }), stroke: new style.Stroke({ color: p.fg, width: 3 }) }),
              zIndex: 20,
              text: new style.Text({ text: "Custom point", offsetY: -20, font, fill: new style.Fill({ color: p.label }), stroke: new style.Stroke({ color: p.halo, width: 4 }) }),
            });
          }
          if (f.getGeometry()?.getType() === "Polygon") {
            return new style.Style({
              stroke: new style.Stroke({ color: hot ? p.fg : alpha(p.accent, 0.75), width: hot ? 2 : 1 }),
              fill: new style.Fill({ color: alpha(p.accent, hot ? 0.18 : 0.06) }),
            });
          }
          const color = kind === "feature" ? p.muted : sel ? p.selected : p.accent;
          return new style.Style({
            image: pin(hot ? p.fg : color, hot ? 8 : kind === "feature" ? 4 : 6, p.halo),
            zIndex: hot ? 10 : sel ? 5 : 1,
            text: hot
              ? new style.Text({
                  text: f.get("name"), offsetY: -18, font,
                  fill: new style.Fill({ color: p.label }), stroke: new style.Stroke({ color: p.halo, width: 4 }),
                })
              : undefined,
          });
        },
      });
      layerRef.current = layer;

      const map = new Map({
        target: el.current,
        layers: [
          ...tileLayers,
          layer,
        ],
        view: new View({
          projection, center: cfg.center, resolution: cfg.startResolution, resolutions,
          extent: cfg.dataExtent, constrainOnlyCenter: true,
        }),
      });
      mapRef.current = map;
      map.getView().fit(cfg.fitExtent, { size: map.getSize(), nearest: false });

      map.on("pointermove", (evt) => {
        if (evt.dragging) return;
        const f = map.forEachFeatureAtPixel(evt.pixel, (x) => x, { hitTolerance: 6 });
        const id = f ? String(f.get("siteId")) : null;
        const target = map.getTargetElement() as HTMLElement | null;
        if (target) target.style.cursor = id ? "pointer" : "";
        if (id !== stateRef.current.hoveredId) stateRef.current.onHover(id);
      });
      map.getViewport()?.addEventListener("mouseleave", () => stateRef.current.onHover(null));
      map.on("singleclick", (evt) => {
        const f = map.forEachFeatureAtPixel(evt.pixel, (x) => x, { hitTolerance: 6 });
        if (f) {
          stateRef.current.onSelect(String(f.get("siteId")));
          return;
        }
        const [lon, lat] = proj4(cfg.projection, "EPSG:4326", evt.coordinate as [number, number]);
        stateRef.current.onPickCoordinate?.(lat, lon);
      });
      syncFeatures();
    })();
    return () => {
      disposed = true;
      mapRef.current?.setTarget(undefined);
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [mode]);

  function syncFeatures() {
    const layer = layerRef.current, toXY = toXYRef.current, mods = featureModRef.current;
    if (!layer || !toXY || !mods) return;
    const src = layer.getSource()!;
    src.clear();
    for (const s of sitesRef.current) {
      if (s.lat === null || s.lon === null) continue;
      if (s.polygon && s.polygon.length > 2) {
        const poly = new mods.Feature({ geometry: new mods.Polygon([s.polygon.map(([lo, la]) => toXY(la, lo))]) });
        poly.setProperties({ siteId: s.id, name: s.name, kind: s.kind });
        src.addFeature(poly);
      }
      const f = new mods.Feature({ geometry: new mods.Point(toXY(s.lat, s.lon)) });
      f.setProperties({ siteId: s.id, name: s.name, kind: s.kind });
      src.addFeature(f);
    }
    const c = customRef.current;
    if (c) {
      const f = new mods.Feature({ geometry: new mods.Point(toXY(c.lat, c.lon)) });
      f.setProperties({ siteId: "__custom", name: "Custom point", kind: "custom" });
      src.addFeature(f);
    }
  }

  // Re-read the colour tokens when the theme changes and redraw the pins.
  useEffect(() => {
    paletteRef.current = null;
    layerRef.current?.changed();
  }, [theme]);

  useEffect(() => {
    sitesRef.current = sites;
    customRef.current = customPoint;
    syncFeatures();
  }, [sites, customPoint]);

  return <div ref={el} className="h-full min-h-105 w-full overflow-hidden rounded-sm bg-black" aria-label={mode === "polar" ? "Map of the lunar south pole" : "Map of the whole Moon"} />;
}
