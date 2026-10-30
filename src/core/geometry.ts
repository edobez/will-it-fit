// Pure 2D geometry on convex polygons. Shared by the main thread and the planner worker.

export type Pt = [number, number];
export type Poly = Pt[];
export type BBox = [number, number, number, number]; // x0, y0, x1, y1

export const rect = (x0: number, y0: number, x1: number, y1: number): Poly => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** Oriented rectangle centred at (cx, cy) with heading th. */
export function orect(cx: number, cy: number, th: number, len: number, wid: number): Poly {
  const c = Math.cos(th), s = Math.sin(th), l = len / 2, w = wid / 2;
  return ([[-l, -w], [l, -w], [l, w], [-l, w]] as Pt[]).map(([x, y]) => [cx + c * x - s * y, cy + s * x + c * y]);
}

export function bbox(poly: Poly): BBox {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}

export const bbOverlap = (a: BBox, b: BBox): boolean => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/** Separating axis test for two convex polygons. Touching does not count as intersecting. */
export function polysIntersect(a: Poly, b: Poly): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const nx = q[1] - p[1], ny = p[0] - q[0];
      let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
      for (const v of a) { const d = v[0] * nx + v[1] * ny; if (d < amin) amin = d; if (d > amax) amax = d; }
      for (const v of b) { const d = v[0] * nx + v[1] * ny; if (d < bmin) bmin = d; if (d > bmax) bmax = d; }
      if (amax <= bmin + 1e-9 || bmax <= amin + 1e-9) return false;
    }
  }
  return true;
}

export function pointInPoly(pt: Pt, poly: Poly): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function closestOnSeg(px: number, py: number, a: Pt, b: Pt): Pt {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return [a[0] + t * dx, a[1] + t * dy];
}

export function segDist(px: number, py: number, a: Pt, b: Pt): number {
  const c = closestOnSeg(px, py, a, b);
  return Math.hypot(px - c[0], py - c[1]);
}

export interface PolyDistance { d: number; p: Pt | null; q: Pt | null }

/** Distance between two non-intersecting polygons; p lies on a, q on b. */
export function polyDistance(a: Poly, b: Poly): PolyDistance {
  let best: PolyDistance = { d: Infinity, p: null, q: null };
  const test = (A: Poly, B: Poly, swap: boolean) => {
    for (const v of A) for (let i = 0; i < B.length; i++) {
      const c = closestOnSeg(v[0], v[1], B[i], B[(i + 1) % B.length]);
      const d = Math.hypot(v[0] - c[0], v[1] - c[1]);
      if (d < best.d) best = swap ? { d, p: c, q: v } : { d, p: v, q: c };
    }
  };
  test(a, b, false); test(b, a, true);
  return best;
}
