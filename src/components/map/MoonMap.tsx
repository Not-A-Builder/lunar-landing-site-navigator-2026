"use client";

import { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import type OlMap from "ol/Map";
import type VectorLayer from "ol/layer/Vector";
import type VectorSource from "ol/source/Vector";
import { GLOBAL_MAP, POLAR_MAP, SOUTH_POLAR_PROJ, type MapLayerConfig } from "@/lib/moon";
import type { Site } from "@/lib/sites";
import { cssVar, useTheme } from "@/lib/theme";
import { computeRulerTicks, type RulerTicks } from "./rulers";
import { MapControls, setReadout } from "./MapControls";
import { MapTip, placeMapTip } from "./MapTip";
import { moonDistanceM, ScaleBar } from "./ScaleBar";

type Palette = { region: string; fg: string; label: string; halo: string; pin: string; pinRing: string; pinHot: string; pinSelected: string };
const readPalette = (): Palette => ({
  region: cssVar("--pin-region"), fg: cssVar("--fg"), label: cssVar("--map-label"), halo: cssVar("--map-halo"),
  pin: cssVar("--pin"), pinRing: cssVar("--pin-ring"), pinHot: cssVar("--pin-hot"), pinSelected: cssVar("--pin-selected"),
});
/** "#rrggbb" + alpha → rgba() for OpenLayers fills. */
const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export type MapMode = "polar" | "global";

/** Width of the coordinate rulers framing the map (both the south-polar and the flat whole-Moon view), px. */
export const RULER_PX = 24;
/** The flat whole-Moon map may zoom out to show this much margin around the chart. */
const GLOBAL_MARGIN = 0.04;

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
  /** clears the custom point (the × in its tooltip) */
  onClearCustom?: () => void;
  /** overlays drawn on top of the map canvas (inside the rulers) */
  children?: React.ReactNode;
};

/**
 * Moon map on NASA Moon Trek tiles, framed by latitude/longitude rulers in both modes. Polar mode: south polar stereographic,
 * with the 0°/180° and 90°E/90°W meridians crossing at the pole. Global mode (flat): equirectangular.
 * Both cap zoom-out at the basemap's extent and show a km / mile scale. Hover is two-way: list → pin via
 * `hoveredId`, pin → list via `onHover`.
 */
export function MoonMap({ mode, sites, hoveredId, selectedIds = [], onHover, onSelect, onPickCoordinate, customPoint = null, onClearCustom, children }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);
  const layerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const guideRef = useRef<VectorLayer<VectorSource> | null>(null);
  const toXYRef = useRef<((lat: number, lon: number) => number[]) | null>(null);
  const stateRef = useRef({ hoveredId, selectedIds, onHover, onSelect, onPickCoordinate });
  const sitesRef = useRef(sites);
  const customRef = useRef(customPoint);
  const theme = useTheme();
  const paletteRef = useRef<Palette | null>(null);
  const featureModRef = useRef<{ Feature: typeof import("ol/Feature").default; Point: typeof import("ol/geom/Point").default; Polygon: typeof import("ol/geom/Polygon").default } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const zoomBy = (d: number) => {
    const v = mapRef.current?.getView();
    const z = v?.getZoom();
    if (v && z !== undefined) v.animate({ zoom: z + d, duration: 220 });
  };
  const [rulers, setRulers] = useState<RulerTicks | null>(null);
  const [mpp, setMpp] = useState<number | null>(null);
  const polar = mode === "polar";

  useEffect(() => {
    stateRef.current = { hoveredId, selectedIds, onHover, onSelect, onPickCoordinate };
    layerRef.current?.changed();
  }, [hoveredId, selectedIds, onHover, onSelect, onPickCoordinate]);

  // Create the map once per mode.
  useEffect(() => {
    let disposed = false;
    let raf = 0;
    (async () => {
      const [
        { default: Map }, { default: View }, { default: TileLayer }, { default: XYZ }, { default: TileGrid },
        { default: VectorLayerC }, { default: VectorSourceC }, { default: Feature }, { default: Point }, { default: Polygon }, { default: LineString },
        proj4Mod, olProj4, olProj, style,
      ] = await Promise.all([
        import("ol/Map"), import("ol/View"), import("ol/layer/Tile"), import("ol/source/XYZ"), import("ol/tilegrid/TileGrid"),
        import("ol/layer/Vector"), import("ol/source/Vector"), import("ol/Feature"), import("ol/geom/Point"), import("ol/geom/Polygon"), import("ol/geom/LineString"),
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
      // No wrapped world copies: pins exist once, inside the chart (the old global setting drew them left and right of it).
      projection.setGlobal?.(false);
      const toXY = (lat: number, lon: number) => proj4("EPSG:4326", cfg.projection, [lon, lat]);
      const toLonLat = (xy: number[]) => proj4(cfg.projection, "EPSG:4326", xy as [number, number]) as [number, number];
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
              wrapX: false,
            }),
            extent: l.extent,
          }),
      );

      const pin = (color: string, r: number, ring: string) =>
        new style.Circle({ radius: r, fill: new style.Fill({ color }), stroke: new style.Stroke({ color: ring, width: 2 }) });
      const font = () => `600 14px ${cssVar("--font-plex-sans") || "system-ui"}, sans-serif`;
      const layer = new VectorLayerC({
        source: new VectorSourceC({ wrapX: false }),
        style: (f) => {
          const id = String(f.get("siteId"));
          const s = stateRef.current;
          const hot = s.hoveredId === id;
          const sel = s.selectedIds.includes(id);
          const kind = f.get("kind");
          const p = (paletteRef.current ??= readPalette());
          if (kind === "custom") {
            return new style.Style({
              image: new style.Circle({ radius: hot ? 10 : 9, fill: new style.Fill({ color: alpha(p.halo, 0.25) }), stroke: new style.Stroke({ color: p.fg, width: 3 }) }),
              zIndex: 20,
            });
          }
          if (f.getGeometry()?.getType() === "Polygon") {
            return new style.Style({
              stroke: new style.Stroke({ color: hot || sel ? p.fg : alpha(p.region, 0.9), width: hot || sel ? 2 : 1.25 }),
              fill: new style.Fill({ color: alpha(p.region, hot || sel ? 0.2 : 0.08) }),
            });
          }
          const color = hot ? p.pinHot : sel ? p.pinSelected : p.pin;
          return new style.Style({
            image: pin(color, hot || sel ? 8 : 6, p.pinRing),
            zIndex: hot ? 10 : sel ? 5 : 1,
          });
        },
      });
      layerRef.current = layer;

      // Dashed guides. South pole: the 0°–180° and 90°E–90°W meridians meet at the pole (90°S).
      const guides = new VectorLayerC({ source: new VectorSourceC({ wrapX: false }), style: (f) => {
        const p = (paletteRef.current ??= readPalette());
        if (f.get("kind") === "pole")
          return new style.Style({
            image: new style.Circle({ radius: 4, fill: new style.Fill({ color: p.halo }), stroke: new style.Stroke({ color: p.fg, width: 2 }) }),
            text: new style.Text({ text: "90°S", textAlign: "left", offsetX: 8, offsetY: 12, font: font(), fill: new style.Fill({ color: p.label }), stroke: new style.Stroke({ color: p.halo, width: 4 }) }),
            zIndex: 2,
          });
        return [
          new style.Style({ stroke: new style.Stroke({ color: alpha(p.halo, 0.55), width: 3 }) }),
          new style.Style({ stroke: new style.Stroke({ color: alpha(p.fg, 0.75), width: 1.25, lineDash: [6, 5] }) }),
        ];
      } });
      guideRef.current = guides;
      if (mode === "polar") {
        const h = cfg.dataExtent[2];
        guides.getSource()!.addFeatures([
          new Feature({ geometry: new LineString([[0, -h], [0, h]]), kind: "meridian" }),
          new Feature({ geometry: new LineString([[-h, 0], [h, 0]]), kind: "meridian" }),
          new Feature({ geometry: new Point([0, 0]), kind: "pole" }),
        ]);
      } else {
        // Flat whole-Moon guides: the equator (0° latitude) and the prime meridian (0° longitude) (D-070).
        guides.getSource()!.addFeatures([
          new Feature({ geometry: new LineString([toXY(0, -180), toXY(0, 180)]), kind: "meridian" }),
          new Feature({ geometry: new LineString([toXY(-90, 0), toXY(90, 0)]), kind: "meridian" }),
        ]);
      }

      // Zoom out no further than the basemap: the polar mosaic square, or the global chart plus a small margin.
      const [x0, y0, x1, y1] = cfg.dataExtent;
      const mx = mode === "polar" ? 0 : (x1 - x0) * GLOBAL_MARGIN, my = mode === "polar" ? 0 : (y1 - y0) * GLOBAL_MARGIN;
      const map = new Map({
        target: el.current,
        // No OpenLayers controls: zoom buttons are our own (MapControls) and the imagery credit is a
        // plain label beside the scale bar, like the 3D globe (D-080).
        controls: [],
        layers: [...tileLayers, guides, layer],
        view: new View({
          projection,
          center: cfg.center,
          extent: [x0 - mx, y0 - my, x1 + mx, y1 + my],
          showFullExtent: true,
          constrainOnlyCenter: false,
          maxResolution: cfg.level0Resolution,
          minResolution: resolutions[resolutions.length - 1],
          resolution: cfg.startResolution,
        }),
      });
      mapRef.current = map;
      map.getView().fit(cfg.fitExtent, { size: map.getSize(), nearest: false });

      // Rulers and scale follow every frame of a pan/zoom.
      let last = "";
      const measure = () => {
        raf = 0;
        const size = map.getSize();
        const v = map.getView();
        const c = v.getCenter();
        if (!size || !c) return;
        placeTip(size);
        const key = `${size.join()}|${c.join()}|${v.getResolution()}`;
        if (key === last) return;
        last = key;
        const [w, hgt] = size;
        const ll = (x: number, y: number) => {
          const co = map.getCoordinateFromPixel([x, y]);
          if (!co) return null;
          const p = toLonLat(co);
          if (mode === "polar") return p;
          // Flat whole-Moon chart: lon depends only on x and lat only on y, so clamping each to the chart
          // keeps ticks off the margin past ±180° / ±90° while edges in that margin still get ticks (D-069).
          return [Math.max(-180, Math.min(180, p[0])), Math.max(-90, Math.min(90, p[1]))] as [number, number];
        };
        const a = ll(w / 2 - 50, hgt / 2), b = ll(w / 2 + 50, hgt / 2);
        setMpp(a && b ? moonDistanceM(a[1], a[0], b[1], b[0]) / 100 : null);
        setRulers(computeRulerTicks(ll, w, hgt));
      };
      // Name tooltip for the hovered pin, else the selected one, else the custom point.
      const placeTip = (size: number[]) => {
        const st = stateRef.current;
        const id = st.hoveredId ?? st.selectedIds[0] ?? null;
        const site = id && id !== "__custom" ? sitesRef.current.find((x) => x.id === id) : null;
        const cp = customRef.current;
        const target = site ? { lat: site.lat, lon: site.lon, name: site.name, r: 10 } : cp && (!id || id === "__custom") ? { lat: cp.lat, lon: cp.lon, name: "Custom point", r: 12, custom: true } : null;
        if (!target) return placeMapTip(tipRef.current, 0, 0, null, 0);
        const px = map.getPixelFromCoordinate(toXY(target.lat, target.lon));
        const inside = !!px && px[0] >= 0 && px[1] >= 0 && px[0] <= size[0] && px[1] <= size[1];
        placeMapTip(tipRef.current, px?.[0] ?? NaN, px?.[1] ?? NaN, target.name, target.r, inside, "custom" in target);
      };
      map.on("postrender", () => {
        if (!raf) raf = requestAnimationFrame(measure);
      });

      const onSites = { layerFilter: (l: unknown) => l === layer, hitTolerance: 6 };
      map.on("pointermove", (evt) => {
        const [lon, lat] = toLonLat(evt.coordinate);
        setReadout(readoutRef.current, { lat, lon });
        if (evt.dragging) return;
        const f = map.forEachFeatureAtPixel(evt.pixel, (x) => x, onSites);
        const id = f ? String(f.get("siteId")) : null;
        const target = map.getTargetElement() as HTMLElement | null;
        if (target) target.style.cursor = id ? "pointer" : "";
        if (id !== stateRef.current.hoveredId) stateRef.current.onHover(id);
      });
      map.getViewport()?.addEventListener("mouseleave", () => {
        stateRef.current.onHover(null);
        setReadout(readoutRef.current, null);
      });
      map.on("singleclick", (evt) => {
        const f = map.forEachFeatureAtPixel(evt.pixel, (x) => x, onSites);
        if (f) {
          stateRef.current.onSelect(String(f.get("siteId")));
          return;
        }
        const [lon, lat] = toLonLat(evt.coordinate);
        stateRef.current.onPickCoordinate?.(lat, lon);
      });
      syncFeatures();
    })();
    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      mapRef.current?.setTarget(undefined);
      mapRef.current = null;
      layerRef.current = null;
      guideRef.current = null;
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
    guideRef.current?.changed();
  }, [theme]);

  useEffect(() => {
    sitesRef.current = sites;
    customRef.current = customPoint;
    syncFeatures();
  }, [sites, customPoint]);

  const inset = RULER_PX;
  return (
    <div className="relative h-full min-h-105 w-full overflow-hidden rounded-sm border border-line bg-black">
      {rulers && <Rulers ticks={rulers} />}
      <div className="absolute" style={{ inset }}>
        <div ref={el} className="h-full w-full" aria-label={polar ? "Map of the lunar south pole" : "Map of the whole Moon"} />
        <div className="pointer-events-none absolute bottom-2 right-2 z-10 flex items-end gap-2">
          <div className="rounded-sm bg-panel/85 px-1.5 py-0.5 text-xs text-muted">{(polar ? POLAR_MAP : GLOBAL_MAP).attribution}</div>
          <ScaleBar metersPerPixel={mpp} />
        </div>
        <MapTip ref={tipRef} onClose={onClearCustom} />
        <MapControls readoutRef={readoutRef} onZoomIn={() => zoomBy(1)} onZoomOut={() => zoomBy(-1)} />
        {children}
      </div>
    </div>
  );
}

/** Latitude (left/right) and longitude (top/bottom) rulers framing the map; ticks follow pan and zoom. */
function Rulers({ ticks }: { ticks: RulerTicks }) {
  const R = RULER_PX;
  const strip = "absolute bg-panel text-muted num text-xs leading-none";
  return (
    <div className="pointer-events-none absolute inset-0 select-none" aria-hidden>
      <div className={`${strip} inset-x-0 top-0 border-b border-line`} style={{ height: R }}>
        {ticks.top.map((t) => (
          <span key={`t${t.label}${t.pos}`} className="absolute top-0 h-full" style={{ left: R + t.pos }}>
            <span className="absolute bottom-0 h-1.5 w-px bg-muted" />
            <span className="absolute top-1 -translate-x-1/2 whitespace-nowrap">{t.label}</span>
          </span>
        ))}
      </div>
      <div className={`${strip} inset-x-0 bottom-0 border-t border-line`} style={{ height: R }}>
        {ticks.bottom.map((t) => (
          <span key={`b${t.label}${t.pos}`} className="absolute top-0 h-full" style={{ left: R + t.pos }}>
            <span className="absolute top-0 h-1.5 w-px bg-muted" />
            <span className="absolute bottom-1 -translate-x-1/2 whitespace-nowrap">{t.label}</span>
          </span>
        ))}
      </div>
      <div className={`${strip} left-0 border-r border-line`} style={{ width: R, top: R, bottom: R }}>
        {ticks.left.map((t) => (
          <span key={`l${t.label}${t.pos}`} className="absolute left-0 w-full" style={{ top: t.pos }}>
            <span className="absolute right-0 h-px w-1.5 bg-muted" />
            <span className="absolute left-1 -translate-y-1/2 rotate-180 whitespace-nowrap [writing-mode:vertical-rl]">{t.label}</span>
          </span>
        ))}
      </div>
      <div className={`${strip} right-0 border-l border-line`} style={{ width: R, top: R, bottom: R }}>
        {ticks.right.map((t) => (
          <span key={`r${t.label}${t.pos}`} className="absolute left-0 w-full" style={{ top: t.pos }}>
            <span className="absolute left-0 h-px w-1.5 bg-muted" />
            <span className="absolute right-1 -translate-y-1/2 whitespace-nowrap [writing-mode:vertical-rl]">{t.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
