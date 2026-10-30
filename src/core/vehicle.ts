import { DEG, clamp } from "./math";
import type { Poly, Pt } from "./geometry";

export interface CarParams {
  carLength: number; carWidth: number; mirrorWidth: number; mirrorFromFront: number;
  wheelbase: number; frontOverhang: number; track: number; turningCircle: number; mirrorsFolded: boolean;
}

/** Derived car geometry in the car frame (origin at the rear axle centre, x forward, y left). */
export interface CarGeom {
  wb: number;        // wheelbase
  ro: number;        // rear overhang
  xf: number;        // front bumper x
  w2: number;        // half body width
  mw2: number;       // half width including mirrors
  mx: number;        // mirror x
  trackHalf: number;
  dmax: number;      // max wheel angle (rad)
}

export function deriveCar(p: CarParams): { geom: CarGeom; warnings: string[] } {
  const warnings: string[] = [];
  const L = Math.max(1, p.carLength), W = Math.max(0.5, p.carWidth), wb = clamp(p.wheelbase, 0.5, L);
  const fo = Math.max(0, p.frontOverhang);
  let ro = L - wb - fo;
  if (ro < 0.05) { warnings.push("Wheelbase plus front overhang exceeds the length; rear overhang forced to 0.05 m."); ro = 0.05; }
  const w2 = W / 2;
  const trackHalf = Math.min(p.track, W) / 2;
  // Max wheel angle from the curb to curb turning circle (traced by the outer front wheel).
  const half = p.turningCircle / 2, s = half * half - wb * wb;
  let dmax = 40 * DEG;
  if (s > 0) { const Rr = Math.sqrt(s) - trackHalf; if (Rr > 0) dmax = Math.atan(wb / Rr); }
  else warnings.push("Turning circle too small for this wheelbase; using 40° max wheel angle.");
  return {
    geom: {
      wb, ro, xf: wb + fo, w2,
      mw2: p.mirrorsFolded ? w2 + 0.05 : Math.max(w2, p.mirrorWidth / 2),
      mx: wb + fo - clamp(p.mirrorFromFront, 0.3, L - 0.3),
      trackHalf,
      dmax: clamp(dmax, 10 * DEG, 55 * DEG),
    },
    warnings,
  };
}

export const hasMirrors = (g: CarGeom): boolean => g.mw2 > g.w2 + 0.005;

export function bodyLocal(g: CarGeom, inflate = 0): Poly {
  return [[-g.ro - inflate, -g.w2 - inflate], [g.xf + inflate, -g.w2 - inflate], [g.xf + inflate, g.w2 + inflate], [-g.ro - inflate, g.w2 + inflate]];
}

/** Body, then left mirror, then right mirror (if any). Indices matter for part labels. */
export function partsLocal(g: CarGeom, inflate = 0): Poly[] {
  const parts = [bodyLocal(g, inflate)];
  if (hasMirrors(g)) {
    const a = g.mx - 0.12 - inflate, b = g.mx + 0.12 + inflate;
    parts.push([[a, g.w2 - 0.02], [b, g.w2 - 0.02], [b, g.mw2 + inflate], [a, g.mw2 + inflate]]);
    parts.push([[a, -g.mw2 - inflate], [b, -g.mw2 - inflate], [b, -g.w2 + 0.02], [a, -g.w2 + 0.02]]);
  }
  return parts;
}

/** Tyre footprints (rear left, rear right, front left, front right), unsteered, slightly padded. */
export function wheelsLocal(g: CarGeom, inflate = 0): Poly[] {
  const wl = 0.72 / 2 + inflate, ww = 0.26 / 2 + inflate, c = g.trackHalf - 0.11;
  return ([[0, c], [0, -c], [g.wb, c], [g.wb, -c]] as Pt[]).map(([x, y]) => [[x - wl, y - ww], [x + wl, y - ww], [x + wl, y + ww], [x - wl, y + ww]]);
}

export const centerLocal = (g: CarGeom): Pt => [(g.xf - g.ro) / 2, 0];
