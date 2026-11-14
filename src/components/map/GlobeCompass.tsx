"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export type GlobeCommand = { type: "reset" } | { type: "zoom"; factor: number };

/**
 * Shared between the 3D scene and the controls drawn over it: the scene writes the camera orientation
 * every frame, and the controls leave one-shot commands for the scene to pick up.
 */
export class GlobeRig {
  readonly quaternion = new THREE.Quaternion();
  /** the globe is turned as in the default view (north up, default side facing) */
  aligned = true;
  /** aligned and at the default zoom: a reset would change nothing */
  atHome = true;
  sync(q: THREE.Quaternion, aligned: boolean, atHome: boolean) {
    this.quaternion.copy(q);
    this.aligned = aligned;
    this.atHome = atHome;
  }
  private pending: GlobeCommand | null = null;
  request(c: GlobeCommand) {
    this.pending = c;
  }
  take(): GlobeCommand | null {
    const c = this.pending;
    this.pending = null;
    return c;
  }
}

const SIZE = 76;
const R = 21;
const C = SIZE / 2;
const D = Math.PI / 180;

// Same lat/lon → xyz convention as MoonGlobe (lon 0° → +X, 90°W → +Z, north → +Y).
const vec = (lat: number, lon: number) => new THREE.Vector3(Math.cos(lat * D) * Math.cos(lon * D), Math.sin(lat * D), -Math.cos(lat * D) * Math.sin(lon * D));

const LINES: { pts: THREE.Vector3[]; prime?: boolean }[] = [
  ...Array.from({ length: 12 }, (_, i) => ({ pts: Array.from({ length: 37 }, (_, k) => vec(-90 + k * 5, i * 30)), prime: i === 0 })),
  ...[-60, -30, 0, 30, 60].map((lat) => ({ pts: Array.from({ length: 73 }, (_, k) => vec(lat, k * 5)) })),
];

/**
 * A compass for the 3D Moon: a small globe that turns with the big one (graticule every 30°, the 0°
 * meridian highlighted, S at the south pole) and a needle on the rim that points to lunar north.
 * Clicking it eases the globe back to the default view. The "N" shows only while the globe sits in that
 * default orientation, and the pointer cursor only while a click would change the view.
 */
export function GlobeCompass({ rig }: { rig: GlobeRig }) {
  const front = useRef<SVGPathElement>(null);
  const back = useRef<SVGPathElement>(null);
  const prime = useRef<SVGPathElement>(null);
  const needle = useRef<SVGGElement>(null);
  const south = useRef<SVGGElement>(null);
  const nLabel = useRef<SVGTextElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let raf = 0;
    const last = new THREE.Quaternion(0, 0, 0, 0);
    const inv = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const draw = () => {
      raf = requestAnimationFrame(draw);
      // These change with zoom too, so update them before the orientation check below.
      nLabel.current?.setAttribute("opacity", rig.aligned ? "1" : "0");
      if (button.current) {
        button.current.style.cursor = rig.atHome ? "default" : "pointer";
        button.current.title = rig.atHome ? "Compass: default view" : "Reset view";
      }
      const q = rig.quaternion;
      if (Math.abs(q.dot(last)) > 1 - 1e-9) return;
      last.copy(q);
      inv.copy(q).invert();
      let f = "", b = "", pm = "";
      for (const line of LINES) {
        let prevFront: boolean | null = null;
        for (const p of line.pts) {
          v.copy(p).applyQuaternion(inv);
          const isFront = v.z >= 0;
          const xy = `${(C + v.x * R).toFixed(2)} ${(C - v.y * R).toFixed(2)}`;
          const cmd = prevFront === isFront ? "L" : "M";
          if (isFront) {
            f += `${cmd}${xy}`;
            if (line.prime) pm += `${cmd}${xy}`;
          } else b += `${cmd}${xy}`;
          prevFront = isFront;
        }
      }
      front.current?.setAttribute("d", f);
      back.current?.setAttribute("d", b);
      prime.current?.setAttribute("d", pm);
      // Needle: direction of lunar north on screen.
      v.set(0, 1, 0).applyQuaternion(inv);
      needle.current?.setAttribute("transform", `rotate(${(Math.atan2(v.x, v.y) / D).toFixed(2)} ${C} ${C})`);
      // South pole marker, dimmed when it is on the far side.
      v.set(0, -1, 0).applyQuaternion(inv);
      south.current?.setAttribute("transform", `translate(${(C + v.x * R).toFixed(2)} ${(C - v.y * R).toFixed(2)})`);
      south.current?.setAttribute("opacity", v.z >= 0 ? "1" : "0.3");
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [rig]);

  return (
    <button
      ref={button}
      type="button"
      onClick={() => rig.request({ type: "reset" })}
      aria-label="Compass. Reset the globe to the default view"
      className="block rounded-full border border-line bg-panel/90 text-fg shadow-sm backdrop-blur transition-colors hover:bg-panel"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden className="block">
        <circle cx={C} cy={C} r={R} fill="var(--panel-2)" stroke="currentColor" strokeOpacity={0.35} strokeWidth={1} />
        <path ref={back} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={0.75} />
        <path ref={front} fill="none" stroke="currentColor" strokeOpacity={0.55} strokeWidth={0.9} />
        <path ref={prime} fill="none" stroke="var(--pin)" strokeWidth={1.6} />
        <g ref={south}>
          <circle r={2.2} fill="var(--pin-selected)" stroke="var(--pin-ring)" strokeWidth={0.8} />
        </g>
        <g ref={needle}>
          <path d={`M${C} ${C - R - 4} L${C - 3.5} ${C - R + 2} L${C + 3.5} ${C - R + 2} Z`} fill="var(--critical)" />
          <text ref={nLabel} style={{ transition: "opacity 150ms" }} x={C} y={C - R - 5} textAnchor="middle" fontSize={14} fontWeight={600} fill="currentColor" className="font-sans">N</text>
        </g>
      </svg>
    </button>
  );
}
