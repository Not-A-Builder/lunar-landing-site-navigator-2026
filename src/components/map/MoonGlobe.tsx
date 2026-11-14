"use client";

import { Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Component, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { GLOBAL_MAP, MOON_RADIUS_M } from "@/lib/moon";
import type { Site } from "@/lib/sites";
import { cssVar, useTheme } from "@/lib/theme";
import { GlobeCompass, GlobeRig } from "./GlobeCompass";
import { MapControls, setReadout } from "./MapControls";
import { MapTip, placeMapTip } from "./MapTip";
import { ScaleBar } from "./ScaleBar";

const D = Math.PI / 180;
const FOV = 35;
/** closest approach, in Moon radii from the centre (~140 km above the surface) */
const MIN_DIST = 1.08;
/** zoom-out cap: a little beyond the distance at which the whole sphere fits the canvas */
const FIT_MARGIN = 1.12;
/** camera eases toward a focused site with this rate (1/s): smooth, not snappy */
const EASE = 2.6;
/** faster easing for the compass reset and the zoom buttons */
const EASE_SNAP = 5;
/** default view: from 35°S over the near side, so the south pole sits low on the disc */
const HOME = { lat: -35, lon: 0 };
const HOME_DIST = 3.6;
/** the view counts as the default one within this angle (rad) and relative zoom difference */
const HOME_ANGLE = 2 * (Math.PI / 180);
const HOME_ZOOM_TOL = 0.02;
/** drag and scroll sensitivity (OrbitControls defaults are 1) */
const ROTATE_SPEED = 0.45;
const ZOOM_SPEED = 0.3;
/** keep the camera off the exact poles so the orbit controls never flip */
const CAM_LAT_LIMIT = 72;

/**
 * Lat/lon (deg, east-positive) → point on a sphere, matching three.js's SphereGeometry UVs for an
 * equirectangular texture whose left edge is 180°W: lon 0° → +X, 90°W → +Z, north → +Y.
 */
export const latLonToVec = (lat: number, lon: number, r = 1) =>
  new THREE.Vector3(
    r * Math.cos(lat * D) * Math.cos(lon * D),
    r * Math.sin(lat * D),
    -r * Math.cos(lat * D) * Math.sin(lon * D),
  );

export const vecToLatLon = (v: THREE.Vector3) => {
  const n = v.clone().normalize();
  return { lat: Math.asin(n.y) / D, lon: Math.atan2(-n.z, n.x) / D };
};

/** Distance at which a unit sphere just fits the narrower field of view. */
const fitDistance = (aspect: number) => {
  const v = FOV * D;
  const h = 2 * Math.atan(Math.tan(v / 2) * aspect);
  return 1 / Math.sin(Math.min(v, h) / 2);
};

// ── Texture: the same LRO WAC global mosaic tiles as the flat map, stitched into one equirectangular image.
const mosaicCache = new Map<number, Promise<HTMLCanvasElement>>();
function loadMosaic(z: number): Promise<HTMLCanvasElement> {
  const hit = mosaicCache.get(z);
  if (hit) return hit;
  const p = (async () => {
    const T = GLOBAL_MAP.tileSize;
    const cols = 2 ** (z + 1),
      rows = 2 ** z;
    const canvas = document.createElement("canvas");
    canvas.width = cols * T;
    canvas.height = rows * T;
    const ctx = canvas.getContext("2d")!;
    const url = GLOBAL_MAP.layers[0].url;
    await Promise.all(
      Array.from({ length: cols * rows }, (_, i) => {
        const x = i % cols,
          y = Math.floor(i / cols);
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            ctx.drawImage(img, x * T, y * T, T, T);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url.replace("{z}", String(z)).replace("{y}", String(y)).replace("{x}", String(x));
        });
      }),
    );
    return canvas;
  })();
  mosaicCache.set(z, p);
  return p;
}

type Props = {
  sites: Site[];
  hoveredId: string | null;
  selectedIds?: string[];
  /** list hover: the globe turns (smoothly) to bring this site to the front */
  focusId?: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onPickCoordinate?: (lat: number, lon: number) => void;
  customPoint?: { lat: number; lon: number } | null;
  /** clears the custom point (the × in its tooltip) */
  onClearCustom?: () => void;
  children?: React.ReactNode;
};

/** The whole Moon as a 3D sphere textured with the LRO WAC mosaic (NASA Moon Trek). Drag to turn, scroll to zoom. */
export default function MoonGlobe({
  sites,
  hoveredId,
  selectedIds = [],
  focusId = null,
  onHover,
  onSelect,
  onPickCoordinate,
  customPoint = null,
  onClearCustom,
  children,
}: Props) {
  const [mpp, setMpp] = useState<number | null>(null);
  const [rig] = useState(() => new GlobeRig());
  const [labelEl, setLabelEl] = useState<HTMLDivElement | null>(null);
  const [readoutEl, setReadoutEl] = useState<HTMLDivElement | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const theme = useTheme();
  const colors = useMemo(() => {
    void theme;
    return {
      region: cssVar("--pin-region"),
      fg: cssVar("--fg"),
      pin: cssVar("--pin"),
      ring: cssVar("--pin-ring"),
      hot: cssVar("--pin-hot"),
      selected: cssVar("--pin-selected"),
      feature: cssVar("--pin-feature"),
    };
  }, [theme]);

  useEffect(() => {
    let live = true;
    const make = (c: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    };
    // Quick first image (2048 px wide), then a sharper one (4096 px).
    loadMosaic(2).then((c) => {
      if (!live) return;
      setTexture(make(c));
      loadMosaic(3).then((c3) => live && setTexture(make(c3)));
    });
    return () => {
      live = false;
    };
  }, []);

  const [webgl] = useState(() => {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      return false;
    }
  });

  return (
    <div className="relative h-full min-h-105 w-full overflow-hidden rounded-sm border border-line bg-black">
      {!webgl ? (
        <NoWebGL />
      ) : (
        <GlobeBoundary>
          <Canvas
            camera={{ fov: FOV, near: 0.01, far: 100, position: latLonToVec(HOME.lat, HOME.lon, HOME_DIST).toArray() }}
            dpr={[1, 2]}
            aria-label="3D globe of the Moon"
          >
            <Scene
              texture={texture}
              sites={sites}
              hoveredId={hoveredId}
              selectedIds={selectedIds}
              focusId={focusId}
              onHover={onHover}
              onSelect={onSelect}
              onPickCoordinate={onPickCoordinate}
              customPoint={customPoint}
              colors={colors}
              onScale={setMpp}
              rig={rig}
              labelEl={labelEl}
              readoutEl={readoutEl}
            />
          </Canvas>
        </GlobeBoundary>
      )}
      {/* name of the hovered (else selected) site, placed every frame by the scene */}
      <MapTip ref={setLabelEl} onClose={onClearCustom} />
      {webgl && !texture && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white/70">
          Loading the LRO WAC mosaic…
        </div>
      )}
      {webgl && (
        <div className="absolute right-3 top-3 z-10">
          <GlobeCompass rig={rig} />
        </div>
      )}
      {webgl && (
        <MapControls
          readoutRef={setReadoutEl}
          onZoomIn={() => rig.request({ type: "zoom", factor: 1 / 1.8 })}
          onZoomOut={() => rig.request({ type: "zoom", factor: 1.8 })}
        />
      )}
      <div className="pointer-events-none absolute bottom-2 right-2 z-10 flex items-end gap-2">
        <div className="rounded-sm bg-panel/85 px-1.5 py-0.5 text-xs text-muted">LRO WAC global mosaic · NASA Moon Trek</div>
        <ScaleBar metersPerPixel={mpp} />
      </div>
      {children}
    </div>
  );
}

function NoWebGL() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/75">
      The 3D Moon needs WebGL, which this browser has turned off or does not support. The flat map shows the
      same sites.
    </div>
  );
}

/** If the WebGL renderer fails to start, show a note instead of breaking the page. */
class GlobeBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <NoWebGL /> : this.props.children;
  }
}

type Colors = { region: string; fg: string; pin: string; ring: string; hot: string; selected: string; feature: string };

function Scene({
  texture,
  sites,
  hoveredId,
  selectedIds,
  focusId,
  onHover,
  onSelect,
  onPickCoordinate,
  customPoint,
  colors,
  onScale,
  rig,
  labelEl,
  readoutEl,
}: Omit<Props, "children"> & {
  texture: THREE.Texture | null;
  selectedIds: string[];
  colors: Colors;
  onScale: (mpp: number | null) => void;
  rig: GlobeRig;
  labelEl: HTMLDivElement | null;
  readoutEl: HTMLDivElement | null;
}) {
  const labelSite = sites.find((x) => x.id === (hoveredId ?? selectedIds[0])) ?? null;
  const tip: TipTarget | null = labelSite
    ? { lat: labelSite.lat, lon: labelSite.lon, name: labelSite.name, r: 10 }
    : customPoint && !hoveredId
      ? { lat: customPoint.lat, lon: customPoint.lon, name: "Custom point", r: 11, closable: true }
      : null;
  const { camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const target = useRef<THREE.Vector3 | null>(null);
  const targetDist = useRef<number | null>(null);
  const ease = useRef(EASE);
  const lastScale = useRef(0);
  const maxDist = fitDistance(size.width / Math.max(1, size.height)) * FIT_MARGIN;

  // Turn toward the focused site (list hover).
  useEffect(() => {
    const s = focusId ? sites.find((x) => x.id === focusId) : null;
    if (!s) return;
    target.current = latLonToVec(Math.max(-CAM_LAT_LIMIT, Math.min(CAM_LAT_LIMIT, s.lat)), s.lon).normalize();
    ease.current = EASE;
  }, [focusId, sites]);

  useFrame((_, dt) => {
    const c = controls.current;
    // Commands from the compass (reset) and the zoom buttons.
    const cmd = rig.take();
    if (cmd) {
      ease.current = EASE_SNAP;
      if (cmd.type === "reset") {
        target.current = latLonToVec(HOME.lat, HOME.lon).normalize();
        targetDist.current = Math.min(HOME_DIST, maxDist);
      } else {
        const alt = (camera.position.length() - 1) * cmd.factor;
        targetDist.current = Math.min(maxDist, Math.max(MIN_DIST, 1 + alt));
      }
    }
    if (targetDist.current !== null) {
      const d0 = camera.position.length();
      const d1 = d0 + (targetDist.current - d0) * (1 - Math.exp(-dt * EASE_SNAP));
      if (Math.abs(targetDist.current - d1) < 1e-4) {
        camera.position.setLength(targetDist.current);
        targetDist.current = null;
      } else camera.position.setLength(d1);
      c?.update();
    }
    const dist = camera.position.length();
    if (target.current) {
      const cur = camera.position.clone().normalize();
      const angle = cur.angleTo(target.current);
      if (angle < 1e-4) target.current = null;
      else {
        const q = new THREE.Quaternion().setFromUnitVectors(cur, target.current);
        const step = new THREE.Quaternion().slerp(q, 1 - Math.exp(-dt * ease.current));
        camera.position.applyQuaternion(step);
        c?.update();
      }
    }
    // Slower turning when close in, so a drag moves the ground about as far as the pointer.
    if (c) c.rotateSpeed = ROTATE_SPEED * Math.max(0.1, Math.min(1, (dist - 1) / 2.4));
    const homeDist = Math.min(HOME_DIST, maxDist);
    const aligned = camera.position.clone().normalize().angleTo(latLonToVec(HOME.lat, HOME.lon).normalize()) < HOME_ANGLE;
    rig.sync(camera.quaternion, aligned, aligned && Math.abs(dist - homeDist) / homeDist < HOME_ZOOM_TOL);
    if (labelEl) placeLabel(labelEl, tip, camera, size);
    // Ground scale at the point under the camera: (distance to surface) / focal length in px.
    const fpx = size.height / 2 / Math.tan((FOV * D) / 2);
    const mpp = ((dist - 1) * MOON_RADIUS_M) / fpx;
    if (Math.abs(mpp - lastScale.current) / mpp > 0.01) {
      lastScale.current = mpp;
      onScale(mpp);
    }
  });

  const pick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return; // a drag, not a click
    const { lat, lon } = vecToLatLon(e.point);
    onPickCoordinate?.(lat, lon);
  };

  return (
    <>
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={MIN_DIST}
        maxDistance={maxDist}
        zoomSpeed={ZOOM_SPEED}
        onStart={() => {
          target.current = null;
          targetDist.current = null;
        }}
      />
      <mesh
        onClick={pick}
        onPointerMove={(e) => {
          e.stopPropagation();
          setReadout(readoutEl, vecToLatLon(e.point));
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(null);
        }}
        onPointerOut={() => setReadout(readoutEl, null)}
      >
        <sphereGeometry args={[1, 128, 96]} />
        {/* keyed: a new material per texture, so the shader is rebuilt with the map */}
        {/* toneMapped off everywhere: show the mosaic and the token colours as they are (r3f tone-maps by default) */}
        {texture ? <meshBasicMaterial key={texture.uuid} map={texture} toneMapped={false} /> : <meshBasicMaterial key="blank" color="#2a2826" toneMapped={false} />}
      </mesh>
      {sites.map((s) => (
        <Marker
          key={s.id}
          site={s}
          hot={hoveredId === s.id}
          selected={selectedIds.includes(s.id)}
          colors={colors}
          onHover={onHover}
          onSelect={onSelect}
        />
      ))}
      {customPoint && <CustomMarker lat={customPoint.lat} lon={customPoint.lon} colors={colors} />}
    </>
  );
}

type TipTarget = { lat: number; lon: number; name: string; r: number; closable?: boolean };

/** Puts the name tooltip over its marker in screen space; hides it on the far side. */
function placeLabel(el: HTMLDivElement, t: TipTarget | null, camera: THREE.Camera, size: { width: number; height: number }) {
  if (!t) return placeMapTip(el, 0, 0, null, 0);
  const p = latLonToVec(t.lat, t.lon, 1.0015);
  const facing = camera.position.clone().sub(p).dot(p) > 0;
  const v = p.clone().project(camera);
  placeMapTip(el, ((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height, t.name, t.r, facing, !!t.closable);
}

/** Keeps a marker facing the camera at a constant on-screen radius (`px`). */
function useBillboard(pos: THREE.Vector3, px: number, ref: React.RefObject<THREE.Object3D | null>) {
  const { camera, size } = useThree();
  useFrame(() => {
    const o = ref.current;
    if (!o) return;
    const fpx = size.height / 2 / Math.tan((FOV * D) / 2);
    const d = camera.position.distanceTo(pos);
    const r = (px * d) / fpx;
    o.scale.setScalar(r);
    o.quaternion.copy(camera.quaternion);
    // Lift the disc toward the viewer by its radius so the sphere doesn't clip it near the limb.
    o.position.copy(camera.position).sub(pos).setLength(r * 1.4).add(pos);
  });
}

function Marker({
  site,
  hot,
  selected,
  colors,
  onHover,
  onSelect,
}: {
  site: Site;
  hot: boolean;
  selected: boolean;
  colors: Colors;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const pos = useMemo(() => latLonToVec(site.lat, site.lon, 1.0015), [site.lat, site.lon]);
  const group = useRef<THREE.Group>(null);
  const r = hot || selected ? 8 : site.kind === "feature" ? 4 : 6;
  useBillboard(pos, r, group);
  const color = hot ? colors.hot : selected ? colors.selected : site.kind === "feature" ? colors.feature : colors.pin;
  const outline = useMemo(
    () =>
      site.polygon && site.polygon.length > 2
        ? [...site.polygon, site.polygon[0]].map(([lo, la]) => latLonToVec(la, lo, 1.001))
        : null,
    [site.polygon],
  );
  return (
    <>
      {outline && (
        <Line
          points={outline}
          color={hot || selected ? colors.fg : colors.region}
          lineWidth={hot || selected ? 2 : 1.25}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      )}
      <group
        ref={group}
        position={pos}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
          onHover(site.id);
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(site.id);
        }}
      >
        <mesh renderOrder={2}>
          <ringGeometry args={[1, 1.35, 32]} />
          <meshBasicMaterial color={colors.ring} toneMapped={false} />
        </mesh>
        <mesh renderOrder={3}>
          <circleGeometry args={[1, 32]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

function CustomMarker({ lat, lon, colors }: { lat: number; lon: number; colors: Colors }) {
  const pos = useMemo(() => latLonToVec(lat, lon, 1.0015), [lat, lon]);
  const group = useRef<THREE.Group>(null);
  useBillboard(pos, 9, group);
  return (
    <group ref={group} position={pos}>
      <mesh renderOrder={4}>
        <ringGeometry args={[0.7, 1, 32]} />
        <meshBasicMaterial color={colors.fg} toneMapped={false} />
      </mesh>
    </group>
  );
}
